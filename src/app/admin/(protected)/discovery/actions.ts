"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  candidateEvidence,
  discoveryAlerts,
  discoveryAuditLogs,
  discoveryCandidates,
  monitoredSources,
  sources,
  stories,
  storySources,
} from "@/db/schema";
import { requireEditorAction, type EditorRole } from "@/lib/auth/dal";
import { textToArticleBlocks } from "@/lib/cms/content";
import { slugifyHeadline } from "@/lib/cms/seo";
import { canonicalizeSourceUrl } from "@/lib/discovery/normalize";
import { assertSafeDiscoveryUrl, discoveryUrlMatchesDomain } from "@/lib/discovery/safety";

const editorRoles: readonly EditorRole[] = ["OWNER", "ADMIN", "EDITOR"];
const reviewerRoles: readonly EditorRole[] = [...editorRoles, "FACT_CHECKER"];
const evidenceRoles: readonly EditorRole[] = [...reviewerRoles, "AUTHOR"];

async function loadCandidate(id: string) {
  const [candidate] = await db
    .select()
    .from(discoveryCandidates)
    .where(eq(discoveryCandidates.id, z.uuid().parse(id)))
    .limit(1);
  if (!candidate) throw new Error("Discovery candidate not found.");
  return candidate;
}

async function audit(options: {
  candidateId?: string;
  storyId?: string;
  actorId: string;
  action: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(discoveryAuditLogs).values({
    candidateId: options.candidateId,
    storyId: options.storyId,
    actorId: options.actorId,
    actorType: "MANUAL",
    action: options.action,
    reason: options.reason,
    metadata: options.metadata ?? {},
  });
}

export async function startCandidateResearch(formData: FormData) {
  const editor = await requireEditorAction(editorRoles);
  const id = z.uuid().parse(formData.get("candidateId"));
  const candidate = await loadCandidate(id);
  if (["DUPLICATE", "REJECTED", "PROMOTED_TO_STORY", "ARCHIVED"].includes(candidate.status)) {
    throw new Error("This candidate cannot be moved into research from its current status.");
  }
  await db.update(discoveryCandidates).set({ status: "RESEARCHING", lastUpdatedAt: new Date() }).where(eq(discoveryCandidates.id, id));
  await audit({ candidateId: id, actorId: editor.id, action: "CANDIDATE_RESEARCH_STARTED", reason: "Editor started manual research." });
  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/discovery/${id}`);
}

export async function rejectCandidate(formData: FormData) {
  const editor = await requireEditorAction(editorRoles);
  const id = z.uuid().parse(formData.get("candidateId"));
  const reason = z.string().trim().min(8).max(1_000).parse(formData.get("reason"));
  const candidate = await loadCandidate(id);
  if (candidate.status === "PROMOTED_TO_STORY") throw new Error("A promoted candidate cannot be rejected.");
  await db.update(discoveryCandidates).set({ status: "REJECTED", lastUpdatedAt: new Date() }).where(eq(discoveryCandidates.id, id));
  await audit({ candidateId: id, actorId: editor.id, action: "CANDIDATE_REJECTED", reason });
  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/discovery/${id}`);
}

export async function updateCandidateVerification(formData: FormData) {
  const editor = await requireEditorAction(reviewerRoles);
  const id = z.uuid().parse(formData.get("candidateId"));
  const input = z.object({
    verificationRecommendation: z.enum(["CONFIRMED", "CREDIBLE_REPORT", "RUMOR", "SPECULATION", "ALLEGED_LEAK"]),
    confidenceScore: z.coerce.number().int().min(0).max(100),
    researchNotes: z.string().trim().max(20_000),
    uncertainties: z.string().trim().max(10_000),
    communityQuestions: z.string().trim().max(10_000),
  }).parse(Object.fromEntries(formData.entries()));
  await loadCandidate(id);
  await db.update(discoveryCandidates).set({
    verificationRecommendation: input.verificationRecommendation,
    confidenceScore: input.confidenceScore,
    researchNotes: input.researchNotes || null,
    uncertainties: input.uncertainties.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    communityQuestions: input.communityQuestions.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    lastUpdatedAt: new Date(),
  }).where(eq(discoveryCandidates.id, id));
  await audit({
    candidateId: id,
    actorId: editor.id,
    action: "VERIFICATION_CHANGED",
    reason: "Newsroom verification review updated.",
    metadata: { verificationRecommendation: input.verificationRecommendation, confidenceScore: input.confidenceScore },
  });
  revalidatePath(`/admin/discovery/${id}`);
}

export async function addCandidateEvidence(formData: FormData) {
  const editor = await requireEditorAction(evidenceRoles);
  const input = z.object({
    candidateId: z.uuid(),
    sourceId: z.uuid(),
    sourceUrl: z.url(),
    title: z.string().trim().min(4).max(300),
    author: z.string().trim().max(200),
    publishedAt: z.string().trim().max(40),
    extractedFacts: z.string().trim().min(4).max(10_000),
    verificationNotes: z.string().trim().max(5_000),
  }).parse(Object.fromEntries(formData.entries()));
  const candidate = await loadCandidate(input.candidateId);
  if (editor.role === "AUTHOR") {
    let permitted = candidate.assignedTo === editor.id;
    if (!permitted && candidate.storyId) {
      const [story] = await db.select({ createdBy: stories.createdBy, authorId: stories.authorId }).from(stories).where(eq(stories.id, candidate.storyId)).limit(1);
      permitted = story?.createdBy === editor.id || (editor.authorId !== null && story?.authorId === editor.authorId);
    }
    if (!permitted) throw new Error("Authors can only add evidence to assigned or promoted research.");
  }
  const [source] = await db.select().from(monitoredSources).where(eq(monitoredSources.id, input.sourceId)).limit(1);
  if (!source) throw new Error("Select a source from the approved registry.");
  const safeUrl = assertSafeDiscoveryUrl(input.sourceUrl).toString();
  if (!discoveryUrlMatchesDomain(safeUrl, source.domain)) {
    throw new Error("The evidence URL must match the selected source registry domain.");
  }
  const canonicalUrl = canonicalizeSourceUrl(safeUrl);
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  if (publishedAt && Number.isNaN(publishedAt.valueOf())) throw new Error("Enter a valid publication date.");
  const facts = input.extractedFacts.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  await db.insert(candidateEvidence).values({
    candidateId: candidate.id,
    sourceId: source.id,
    sourceUrl: canonicalUrl,
    title: input.title,
    author: input.author || null,
    publishedAt,
    authorityTier: source.authorityTier,
    authorityScore: source.reliabilityScore,
    isCorroborating: true,
    extractedFacts: facts,
    verificationNotes: input.verificationNotes || null,
    createdBy: editor.id,
  }).onConflictDoNothing({ target: [candidateEvidence.candidateId, candidateEvidence.sourceUrl] });
  await audit({
    candidateId: candidate.id,
    actorId: editor.id,
    action: "EVIDENCE_ADDED",
    reason: "A newsroom member added a source-registry evidence record for editorial review.",
    metadata: { sourceId: source.id, sourceUrl: canonicalUrl },
  });
  revalidatePath(`/admin/discovery/${candidate.id}`);
}

export async function mergeCandidateIntoCluster(formData: FormData) {
  const editor = await requireEditorAction(editorRoles);
  const id = z.uuid().parse(formData.get("candidateId"));
  const clusterId = z.uuid().parse(formData.get("clusterId"));
  await loadCandidate(id);
  await db.update(discoveryCandidates).set({ clusterId, duplicateStatus: "RELATED", lastUpdatedAt: new Date() }).where(eq(discoveryCandidates.id, id));
  await audit({ candidateId: id, actorId: editor.id, action: "CANDIDATE_MERGED", reason: "Editor assigned the candidate to an existing event cluster.", metadata: { clusterId } });
  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/discovery/${id}`);
  revalidatePath(`/admin/discovery/clusters/${clusterId}`);
}

export async function promoteCandidateToDraft(formData: FormData) {
  const editor = await requireEditorAction(editorRoles);
  const id = z.uuid().parse(formData.get("candidateId"));
  const candidate = await loadCandidate(id);
  if (candidate.status === "PROMOTED_TO_STORY" || candidate.storyId) {
    throw new Error("This candidate has already been promoted.");
  }
  if (["DUPLICATE", "REJECTED", "ARCHIVED"].includes(candidate.status)) {
    throw new Error("Rejected, duplicate, or archived candidates cannot be promoted.");
  }

  const sourceRecord = await db.transaction(async (tx) => {
    const [monitored] = await tx.query.monitoredSources.findMany({
      where: (table, { eq: same }) => same(table.id, candidate.sourceId),
      limit: 1,
    });
    if (!monitored) throw new Error("The candidate source registry record is missing.");
    await tx.insert(sources).values({
      name: monitored.name,
      url: candidate.canonicalUrl,
      sourceType: monitored.sourceType,
      publication: monitored.name,
      authorName: candidate.sourceAuthor,
      sourcePublishedAt: candidate.sourcePublishedAt,
      isFirstParty: monitored.isFirstParty,
      reliabilityNotes: monitored.historicalAccuracyNotes,
      verificationNotes: `Discovery authority ${monitored.authorityTier}; score ${monitored.reliabilityScore}/100.`,
      createdBy: editor.id,
    }).onConflictDoNothing({ target: sources.url });
    const [evidenceSource] = await tx.select().from(sources).where(eq(sources.url, candidate.canonicalUrl)).limit(1);
    if (!evidenceSource) throw new Error("The evidence source could not be prepared.");
    return evidenceSource;
  });

  const baseSlug = slugifyHeadline(candidate.suggestedHeadline ?? candidate.title) || `candidate-${id.slice(0, 8)}`;
  const [existingSlug] = await db.select({ id: stories.id }).from(stories).where(eq(stories.slug, baseSlug)).limit(1);
  const slug = existingSlug ? `${baseSlug}-${id.slice(0, 8)}` : baseSlug;
  const summaryBase = candidate.suggestedSummary ?? candidate.excerpt ?? "INSUFFICIENT EVIDENCE";
  const summary = summaryBase.length >= 40
    ? summaryBase.slice(0, 500)
    : `${summaryBase}. This newsroom draft requires source verification before editorial approval.`.slice(0, 500);
  const factLines = (candidate.knownFacts as Array<{ fact?: string }>).map(({ fact }) => fact?.trim()).filter((fact): fact is string => Boolean(fact));
  const bodyText = factLines.length
    ? `## Known facts\n\n${factLines.map((fact) => `- ${fact}`).join("\n")}\n\n## Uncertainties\n\n${candidate.uncertainties.map((uncertainty) => `- ${uncertainty}`).join("\n")}`
    : "## Research status\n\nINSUFFICIENT EVIDENCE\n\nThis draft must not advance until the original source and independent corroboration have been reviewed.";

  const storyId = await db.transaction(async (tx) => {
    const [story] = await tx.insert(stories).values({
      headline: candidate.suggestedHeadline ?? candidate.title,
      slug,
      urlPath: `/news/${slug}`,
      summary,
      bodyText,
      body: textToArticleBlocks(bodyText),
      contentType: "NEWS",
      verificationStatus: candidate.verificationRecommendation,
      status: "DRAFTING",
      editorId: editor.id,
      primarySourceId: sourceRecord.id,
      originalSourcePublishedAt: candidate.sourcePublishedAt,
      featured: false,
      breaking: false,
      trendingEligible: false,
      internalNotes: `Promoted manually from discovery candidate ${candidate.id}. ${candidate.uncertainties.join(" ")}`,
      createdBy: editor.id,
    }).returning({ id: stories.id });
    await tx.insert(storySources).values({ storyId: story.id, sourceId: sourceRecord.id, isPrimary: true });
    await tx.update(discoveryCandidates).set({ status: "PROMOTED_TO_STORY", storyId: story.id, lastUpdatedAt: new Date() }).where(eq(discoveryCandidates.id, id));
    await tx.insert(discoveryAuditLogs).values({
      candidateId: id,
      storyId: story.id,
      actorId: editor.id,
      actorType: "MANUAL",
      action: "STORY_PROMOTED",
      reason: "Editor promoted the candidate to a private DRAFTING story.",
      metadata: { status: "DRAFTING", automaticPublishing: false },
    });
    return story.id;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/discovery");
  revalidatePath("/admin/stories");
  redirect(`/admin/stories/${storyId}?promoted=1`);
}

export async function updateDiscoveryAlert(formData: FormData) {
  const editor = await requireEditorAction(editorRoles);
  const id = z.uuid().parse(formData.get("alertId"));
  const status = z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]).parse(formData.get("status"));
  const now = new Date();
  await db.update(discoveryAlerts).set({
    status,
    acknowledgedBy: editor.id,
    acknowledgedAt: now,
    resolvedAt: status === "RESOLVED" ? now : null,
  }).where(eq(discoveryAlerts.id, id));
  revalidatePath("/admin/discovery");
}
