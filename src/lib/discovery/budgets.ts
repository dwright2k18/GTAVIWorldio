import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { DiscoveryFetcher } from "./connectors/base";

export class DailyDiscoveryRequestLimitReached extends Error {
  constructor() {
    super("The daily discovery request limit has been reached.");
    this.name = "DailyDiscoveryRequestLimitReached";
  }
}

export function discoveryUsageDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function reserveDailyUsage(options: {
  usageDate: string;
  requestDelta: number;
  candidateDelta: number;
  requestLimit: number;
  candidateLimit: number;
}) {
  const rows = await db.execute<{ reserved: boolean }>(sql`
    select public.reserve_discovery_daily_usage(
      ${options.usageDate},
      ${options.requestDelta},
      ${options.candidateDelta},
      ${options.requestLimit},
      ${options.candidateLimit}
    ) as reserved
  `);
  return Boolean(rows[0]?.reserved);
}

export async function releaseDailyCandidateSlot(usageDate: string) {
  await db.execute(sql`
    select public.release_discovery_daily_usage(${usageDate}, 0, 1)
  `);
}

export async function reserveDailyCandidateSlot(options: {
  usageDate: string;
  requestLimit: number;
  candidateLimit: number;
}) {
  return reserveDailyUsage({
    ...options,
    requestDelta: 0,
    candidateDelta: 1,
  });
}

export function createDailyBudgetedFetcher(options: {
  fetcher: DiscoveryFetcher;
  usageDate: string;
  requestLimit: number;
  candidateLimit: number;
}) {
  let requestsReserved = 0;
  const fetcher: DiscoveryFetcher = async (input, init) => {
    const reserved = await reserveDailyUsage({
      usageDate: options.usageDate,
      requestDelta: 1,
      candidateDelta: 0,
      requestLimit: options.requestLimit,
      candidateLimit: options.candidateLimit,
    });
    if (!reserved) throw new DailyDiscoveryRequestLimitReached();
    requestsReserved += 1;
    return options.fetcher(input, init);
  };
  return {
    fetcher,
    requestsReserved: () => requestsReserved,
  };
}
