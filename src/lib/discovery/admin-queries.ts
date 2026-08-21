import "server-only";

import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  candidateEvidence,
  discoveryAlerts,
  discoveryAuditLogs,
  discoveryCandidates,
  discoverySettings,
  discoveryUsageDaily,
  evergreenPages,
  monitoredSources,
  sourceFetchRuns,
  stories,
  storyClusters,
  type EditorProfile,
} from "@/db/schema";

function candidateVisibleToEditor(
  editor: EditorProfile,
  candidate: {
    assignedTo: string | null;
    storyCreatedBy: string | null;
    storyAuthorId: string | null;
  },
) {
  if (editor.role !== "AUTHOR") return true;
  return (
    candidate.assignedTo === editor.id ||
    candidate.storyCreatedBy === editor.id ||
    (editor.authorId !== null && candidate.storyAuthorId === editor.authorId)
  );
}

export async function getDiscoveryDashboard(editor: EditorProfile) {
  const candidateRows = await db
    .select({
      candidate: discoveryCandidates,
      sourceName: monitoredSources.name,
      sourceTier: monitoredSources.authorityTier,
      sourceDomain: monitoredSources.domain,
      clusterTitle: storyClusters.title,
      storyCreatedBy: stories.createdBy,
      storyAuthorId: stories.authorId,
    })
    .from(discoveryCandidates)
    .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
    .leftJoin(storyClusters, eq(discoveryCandidates.clusterId, storyClusters.id))
    .leftJoin(stories, eq(discoveryCandidates.storyId, stories.id))
    .orderBy(desc(discoveryCandidates.newsworthinessScore), desc(discoveryCandidates.discoveredAt))
    .limit(200);

  const visibleCandidates = candidateRows.filter((row) => candidateVisibleToEditor(editor, {
    assignedTo: row.candidate.assignedTo,
    storyCreatedBy: row.storyCreatedBy,
    storyAuthorId: row.storyAuthorId,
  }));
  const alerts = editor.role === "AUTHOR"
    ? []
    : await db
        .select()
        .from(discoveryAlerts)
        .where(inArray(discoveryAlerts.status, ["NEW", "ACKNOWLEDGED"]))
        .orderBy(desc(discoveryAlerts.priority), desc(discoveryAlerts.createdAt))
        .limit(30);
  const sourceHealth = await db
    .select({ status: monitoredSources.healthStatus, total: count() })
    .from(monitoredSources)
    .groupBy(monitoredSources.healthStatus);

  return {
    candidates: visibleCandidates,
    alerts,
    counts: Object.fromEntries(
      visibleCandidates.map(({ candidate }) => candidate.status).reduce((entries, status) => {
        entries.set(status, (entries.get(status) ?? 0) + 1);
        return entries;
      }, new Map<string, number>()),
    ),
    sourceHealth: Object.fromEntries(sourceHealth.map((row) => [row.status, Number(row.total)])),
  };
}

export async function getDiscoveryCandidate(id: string, editor: EditorProfile) {
  const [record] = await db
    .select({
      candidate: discoveryCandidates,
      source: monitoredSources,
      cluster: storyClusters,
      storyCreatedBy: stories.createdBy,
      storyAuthorId: stories.authorId,
    })
    .from(discoveryCandidates)
    .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
    .leftJoin(storyClusters, eq(discoveryCandidates.clusterId, storyClusters.id))
    .leftJoin(stories, eq(discoveryCandidates.storyId, stories.id))
    .where(eq(discoveryCandidates.id, id))
    .limit(1);
  if (!record || !candidateVisibleToEditor(editor, {
    assignedTo: record.candidate.assignedTo,
    storyCreatedBy: record.storyCreatedBy,
    storyAuthorId: record.storyAuthorId,
  })) return null;

  const evidence = await db
    .select()
    .from(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, id))
    .orderBy(desc(candidateEvidence.isPrimary), desc(candidateEvidence.authorityScore));
  const audit = await db
    .select()
    .from(discoveryAuditLogs)
    .where(eq(discoveryAuditLogs.candidateId, id))
    .orderBy(desc(discoveryAuditLogs.createdAt))
    .limit(50);
  const availableSources = await db
    .select({
      id: monitoredSources.id,
      name: monitoredSources.name,
      authorityTier: monitoredSources.authorityTier,
      reliabilityScore: monitoredSources.reliabilityScore,
    })
    .from(monitoredSources)
    .orderBy(asc(monitoredSources.authorityTier), asc(monitoredSources.name));
  const clusterCandidates = record.cluster
    ? await db
        .select({
          id: discoveryCandidates.id,
          title: discoveryCandidates.title,
          status: discoveryCandidates.status,
          sourceName: monitoredSources.name,
          sourceTier: monitoredSources.authorityTier,
          sourcePublishedAt: discoveryCandidates.sourcePublishedAt,
        })
        .from(discoveryCandidates)
        .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
        .where(eq(discoveryCandidates.clusterId, record.cluster.id))
        .orderBy(asc(discoveryCandidates.sourcePublishedAt))
    : [];

  return { ...record, evidence, audit, availableSources, clusterCandidates };
}

export async function getStoryCluster(id: string, editor: EditorProfile) {
  const [cluster] = await db.select().from(storyClusters).where(eq(storyClusters.id, id)).limit(1);
  if (!cluster) return null;
  const candidates = await db
    .select({
      candidate: discoveryCandidates,
      sourceName: monitoredSources.name,
      sourceTier: monitoredSources.authorityTier,
      storyCreatedBy: stories.createdBy,
      storyAuthorId: stories.authorId,
    })
    .from(discoveryCandidates)
    .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
    .leftJoin(stories, eq(discoveryCandidates.storyId, stories.id))
    .where(eq(discoveryCandidates.clusterId, id))
    .orderBy(asc(discoveryCandidates.sourcePublishedAt));
  const visible = candidates.filter((row) => candidateVisibleToEditor(editor, {
    assignedTo: row.candidate.assignedTo,
    storyCreatedBy: row.storyCreatedBy,
    storyAuthorId: row.storyAuthorId,
  }));
  if (!visible.length && editor.role === "AUTHOR") return null;
  return { cluster, candidates: visible };
}

export async function listDiscoverySources() {
  const sources = await db.select().from(monitoredSources).orderBy(asc(monitoredSources.authorityTier), asc(monitoredSources.name));
  const recentRuns = await db
    .select()
    .from(sourceFetchRuns)
    .orderBy(desc(sourceFetchRuns.startedAt))
    .limit(100);
  return sources.map((source) => ({
    ...source,
    lastRun: recentRuns.find((run) => run.sourceId === source.id) ?? null,
  }));
}

export async function getSeoOpportunities() {
  const candidates = await db
    .select({
      candidate: discoveryCandidates,
      sourceName: monitoredSources.name,
      evergreenPath: evergreenPages.path,
      evergreenTitle: evergreenPages.title,
    })
    .from(discoveryCandidates)
    .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
    .leftJoin(evergreenPages, eq(discoveryCandidates.evergreenPageId, evergreenPages.id))
    .where(inArray(discoveryCandidates.status, ["DISCOVERED", "TRIAGED", "RESEARCHING"]))
    .orderBy(desc(discoveryCandidates.seoOpportunityScore), desc(discoveryCandidates.discoveredAt))
    .limit(100);
  return candidates.filter(({ candidate }) => candidate.seoOpportunityScore >= 35 || candidate.evergreenUpdateRecommended);
}

export async function getDiscoveryControls() {
  const [settings] = await db.select().from(discoverySettings).limit(1);
  const usage = await db
    .select()
    .from(discoveryUsageDaily)
    .orderBy(desc(discoveryUsageDaily.usageDate))
    .limit(31);
  return { settings: settings ?? null, usage };
}
