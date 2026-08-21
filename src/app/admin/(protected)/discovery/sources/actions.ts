"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { discoveryAuditLogs, monitoredSources } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";
import { assertSafeDiscoveryUrl } from "@/lib/discovery/safety";

const sourceSchema = z.object({
  name: z.string().trim().min(3).max(180),
  url: z.url(),
  sourceType: z.enum(["FIRST_PARTY", "PRESS_RELEASE", "INVESTOR_REPORT", "INTERVIEW", "JOURNALISM", "PUBLIC_RECORD", "COMMUNITY_DISCOVERY", "SOCIAL_POST", "OTHER"]),
  authorityTier: z.enum(["TIER_1", "TIER_2", "TIER_3", "TIER_4"]),
  reliabilityScore: z.coerce.number().int().min(0).max(100),
  connectorKind: z.enum(["RSS", "ATOM", "HTML_LISTING", "HTML_CHANGE", "JSON_FEED", "MANUAL"]),
  connectorConfig: z.string().trim().max(10_000).default("{}"),
  historicalAccuracyNotes: z.string().trim().max(10_000).optional(),
  termsPolicyNotes: z.string().trim().max(10_000).optional(),
  rateLimitPerHour: z.coerce.number().int().min(1).max(120),
  minCheckIntervalMinutes: z.coerce.number().int().min(5).max(10_080),
  isFirstParty: z.preprocess((value) => value === "on", z.boolean()),
  isActive: z.preprocess((value) => value === "on", z.boolean()),
});

export async function saveMonitoredSource(sourceId: string | null, formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN"]);
  const input = sourceSchema.parse(Object.fromEntries(formData.entries()));
  const url = assertSafeDiscoveryUrl(input.url);
  let connectorConfig: Record<string, unknown>;
  try {
    const parsed = JSON.parse(input.connectorConfig) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    connectorConfig = parsed as Record<string, unknown>;
  } catch {
    throw new Error("Connector configuration must be a JSON object.");
  }
  const values = {
    name: input.name,
    url: url.toString(),
    domain: url.hostname.toLowerCase(),
    sourceType: input.sourceType,
    authorityTier: input.authorityTier,
    isFirstParty: input.isFirstParty,
    reliabilityScore: input.reliabilityScore,
    historicalAccuracyNotes: input.historicalAccuracyNotes || null,
    connectorKind: input.connectorKind,
    connectorConfig,
    isActive: input.isActive,
    rateLimitPerHour: input.rateLimitPerHour,
    minCheckIntervalMinutes: input.minCheckIntervalMinutes,
    termsPolicyNotes: input.termsPolicyNotes || null,
  };
  if (sourceId) {
    const id = z.uuid().parse(sourceId);
    await db.update(monitoredSources).set(values).where(eq(monitoredSources.id, id));
    await db.insert(discoveryAuditLogs).values({ actorId: editor.id, actorType: "MANUAL", action: "SOURCE_CHANGED", reason: "Editor updated a monitored source.", metadata: { sourceId: id } });
  } else {
    const [source] = await db.insert(monitoredSources).values({ ...values, isActive: false, createdBy: editor.id }).returning({ id: monitoredSources.id });
    await db.insert(discoveryAuditLogs).values({ actorId: editor.id, actorType: "MANUAL", action: "SOURCE_CREATED", reason: "Editor added a monitored source in inactive-by-default mode.", metadata: { sourceId: source.id } });
  }
  revalidatePath("/admin/discovery");
  revalidatePath("/admin/discovery/sources");
}
