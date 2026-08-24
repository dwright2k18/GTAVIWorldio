type DatabaseEnvironment = {
  [key: string]: string | undefined;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
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

export function databaseUrl(environment: DatabaseEnvironment = process.env) {
  return configuredDatabaseUrl(environment) ?? PREVIEW_DISABLED_DATABASE_URL;
}
