import { config } from "dotenv";
import postgres from "postgres";

import { scoreCandidate } from "@/lib/discovery/scoring";
import type { ConnectorItem, DiscoverySource } from "@/lib/discovery/types";

config({ path: ".env.development.local", quiet: true });

const candidateId = "70db3fc3-0671-4824-80b4-6682ac6d7b76";
const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is required for the Phase 4.2 scoring replay.");

const client = postgres(connectionString, { max: 1, prepare: false });

function snapshot(scored: ReturnType<typeof scoreCandidate>) {
  return {
    scoringVersion: scored.scoringVersion,
    inputHash: scored.inputHash,
    sourceAuthority: scored.sourceAuthorityScore,
    confidence: scored.confidenceScore,
    newsworthiness: scored.newsworthinessScore,
    seoOpportunity: scored.seoOpportunityScore,
    trend: scored.trendScore,
    quickHit: scored.quickHitScore,
    primaryVideo: scored.primaryVideoScore,
    breakdown: scored.scoreBreakdowns,
  };
}

async function main() {
  const [row] = await client<{
    id: string;
    title: string;
    normalized_title: string;
    source_url: string;
    canonical_url: string;
    source_author: string | null;
    source_published_at: Date | null;
    excerpt: string | null;
    source_hash: string;
    content_hash: string;
    change_type: ConnectorItem["changeType"];
    discovered_at: Date;
    source_id: string;
    source_name: string;
    monitored_url: string;
    domain: string;
    source_type: DiscoverySource["sourceType"];
    authority_tier: DiscoverySource["authorityTier"];
    is_first_party: boolean;
    reliability_score: number;
    connector_kind: DiscoverySource["connectorKind"];
    connector_config: Record<string, unknown>;
    rate_limit_per_hour: number;
    min_check_interval_minutes: number;
    terms_policy_notes: string | null;
    independent_source_count: number;
  }[]>`
    select
      candidate.id,
      candidate.title,
      candidate.normalized_title,
      candidate.source_url,
      candidate.canonical_url,
      candidate.source_author,
      candidate.source_published_at,
      candidate.excerpt,
      candidate.source_hash,
      candidate.content_hash,
      candidate.change_type,
      candidate.discovered_at,
      source.id as source_id,
      source.name as source_name,
      source.url as monitored_url,
      source.domain,
      source.source_type,
      source.authority_tier,
      source.is_first_party,
      source.reliability_score,
      source.connector_kind,
      source.connector_config,
      source.rate_limit_per_hour,
      source.min_check_interval_minutes,
      source.terms_policy_notes,
      greatest(1, count(distinct evidence.source_id))::int as independent_source_count
    from public.discovery_candidates candidate
    join public.monitored_sources source on source.id = candidate.source_id
    left join public.candidate_evidence evidence on evidence.candidate_id = candidate.id
    where candidate.id = ${candidateId}
    group by candidate.id, source.id
  `;
  if (!row) throw new Error(`Legitimate discovery candidate ${candidateId} was not found.`);

  const source: DiscoverySource = {
    id: row.source_id,
    name: row.source_name,
    url: row.monitored_url,
    domain: row.domain,
    sourceType: row.source_type,
    authorityTier: row.authority_tier,
    isFirstParty: row.is_first_party,
    reliabilityScore: row.reliability_score,
    connectorKind: row.connector_kind,
    connectorConfig: row.connector_config,
    rateLimitPerHour: row.rate_limit_per_hour,
    minCheckIntervalMinutes: row.min_check_interval_minutes,
    termsPolicyNotes: row.terms_policy_notes,
  };
  const item: ConnectorItem = {
    title: row.title,
    url: row.source_url,
    canonicalUrl: row.canonical_url,
    author: row.source_author ?? undefined,
    summary: row.excerpt ?? undefined,
    publishedAt: row.source_published_at ?? undefined,
    sourceHash: row.source_hash,
    contentHash: row.content_hash,
    changeType: row.change_type,
    directEvidence: row.is_first_party,
    metadata: { replayCandidateId: row.id },
  };
  const baseSignals = {
    independentSourceCount: row.independent_source_count,
    evidenceComplete: Boolean(row.excerpt),
    isNovel: true,
    referenceTime: row.discovered_at,
  };
  const runs = Array.from({ length: 10 }, () => snapshot(scoreCandidate(source, item, baseSignals)));
  const uniqueRuns = new Set(runs.map((run) => JSON.stringify(run)));
  if (uniqueRuns.size !== 1) throw new Error("The legitimate candidate did not produce stable deterministic scores across 10 runs.");
  const persisted = await client<{ id: string }[]>`
    insert into public.discovery_score_runs (
      candidate_id,
      scoring_version,
      input_hash,
      source_authority_score,
      confidence_score,
      newsworthiness_score,
      seo_opportunity_score,
      trend_score,
      quick_hit_score,
      primary_video_score,
      component_breakdown,
      input_snapshot,
      is_test
    ) values (
      ${candidateId},
      ${runs[0].scoringVersion},
      ${runs[0].inputHash},
      ${runs[0].sourceAuthority},
      ${runs[0].confidence},
      ${runs[0].newsworthiness},
      ${runs[0].seoOpportunity},
      ${runs[0].trend},
      ${runs[0].quickHit},
      ${runs[0].primaryVideo},
      ${client.json(runs[0].breakdown)},
      ${client.json({
        source: {
          id: source.id,
          authorityTier: source.authorityTier,
          isFirstParty: source.isFirstParty,
          reliabilityScore: source.reliabilityScore,
        },
        evidence: {
          canonicalUrl: item.canonicalUrl,
          normalizedTitle: row.normalized_title,
          summary: item.summary ?? null,
          publishedAt: item.publishedAt?.toISOString() ?? null,
          contentHash: item.contentHash,
          changeType: item.changeType,
          directEvidence: item.directEvidence,
        },
        signals: {
          independentSourceCount: baseSignals.independentSourceCount,
          evidenceComplete: baseSignals.evidenceComplete,
          isNovel: baseSignals.isNovel,
          referenceTime: baseSignals.referenceTime.toISOString(),
        },
        scoringVersion: runs[0].scoringVersion,
      })},
      false
    )
    on conflict (candidate_id, scoring_version, input_hash) do nothing
    returning id
  `;

  const controlled = snapshot(scoreCandidate(source, item, {
    ...baseSignals,
    independentSourceCount: row.independent_source_count + 1,
  }));
  const baseline = runs[0];
  const changedScores = (Object.keys(baseline) as Array<keyof typeof baseline>)
    .filter((key) => !["inputHash", "breakdown"].includes(key))
    .filter((key) => JSON.stringify(baseline[key]) !== JSON.stringify(controlled[key]));
  if (changedScores.join(",") !== "confidence") {
    throw new Error(`Controlled corroboration changed unexpected scores: ${changedScores.join(", ") || "none"}.`);
  }

  console.log(JSON.stringify({
    candidateId,
    consecutiveRuns: runs.length,
    uniqueResults: uniqueRuns.size,
    scoreHistory: {
      stored: true,
      insertedNow: persisted.length === 1,
      reusedExisting: persisted.length === 0,
    },
    baseline,
    controlledEvidenceSimulation: {
      persisted: false,
      changedScores,
      confidenceBefore: baseline.confidence,
      confidenceAfter: controlled.confidence,
      inputHashChanged: baseline.inputHash !== controlled.inputHash,
    },
  }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
