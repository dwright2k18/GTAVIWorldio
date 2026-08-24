export type DatabaseEnvironment = {
  [key: string]: string | undefined;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
};

export type RuntimeDatabaseCandidate = {
  kind: "transaction_pooler" | "session_or_direct_fallback";
  url: string;
};

// Credential-free fail-closed target for Git Previews without database access.
export const PREVIEW_DISABLED_DATABASE_URL =
  "postgres://preview_disabled:preview_disabled@127.0.0.1:1/preview_disabled";

function configuredUrl(value: string | undefined) {
  return value?.trim() ? value : undefined;
}

export function configuredDatabaseUrl(environment: DatabaseEnvironment = process.env) {
  return (
    configuredUrl(environment.POSTGRES_URL) ??
    configuredUrl(environment.POSTGRES_URL_NON_POOLING) ??
    null
  );
}

/**
 * Vercel runtime traffic starts with Supabase's transaction pooler. A distinct
 * session/direct URL is retained as a bounded fallback for transient startup
 * failures. The fallback is never exposed to browser code.
 */
export function runtimeDatabaseCandidates(
  environment: DatabaseEnvironment = process.env,
): RuntimeDatabaseCandidate[] {
  const pooled = configuredUrl(environment.POSTGRES_URL);
  const fallback = configuredUrl(environment.POSTGRES_URL_NON_POOLING);
  const candidates: RuntimeDatabaseCandidate[] = [];

  if (pooled) {
    candidates.push({ kind: "transaction_pooler", url: pooled });
  }
  if (fallback && fallback !== pooled) {
    candidates.push({ kind: "session_or_direct_fallback", url: fallback });
  }

  return candidates;
}

export function databaseUrl(environment: DatabaseEnvironment = process.env) {
  return configuredDatabaseUrl(environment) ?? PREVIEW_DISABLED_DATABASE_URL;
}
