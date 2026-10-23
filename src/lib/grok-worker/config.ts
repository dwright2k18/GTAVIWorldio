import "server-only";

function enabled(value: string | undefined) {
  return value === "true";
}
export function grokWorkerEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function grokWorkerApiEnvironmentEnabled() {
  return enabled(process.env.GROK_WORKER_API_ENABLED);
}

export function grokAutoPublishEnvironmentEnabled() {
  return enabled(process.env.GROK_AUTO_PUBLISH_ENABLED);
}

export function grokTokenPepper() {
  const pepper = process.env.GROK_WORKER_TOKEN_PEPPER?.trim();
  if (!pepper || pepper.length < 32) {
    throw new Error("Grok Worker authentication is not configured.");
  }
  return pepper;
}
