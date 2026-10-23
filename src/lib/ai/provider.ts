import "server-only";

import { generateText, Output } from "ai";
import type { ZodType } from "zod";

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  costMicros: number | null;
};

export type StructuredGenerationRequest<T> = {
  modelId: string;
  systemRules: string;
  sourceData: string;
  schema: ZodType<T>;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  actorId: string;
  tags: string[];
};

export type StructuredGenerationResult<T> = {
  output: T;
  providerCode: string;
  modelId: string;
  providerRequestId: string | null;
  usage: ProviderUsage;
};

export interface NewsroomAiProvider {
  readonly code: string;
  readonly enabled: boolean;
  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>>;
}

export class ProviderDisabledError extends Error {
  constructor() {
    super("No approved AI provider is enabled.");
    this.name = "ProviderDisabledError";
  }
}

export class DisabledNewsroomProvider implements NewsroomAiProvider {
  readonly code = "DISABLED";
  readonly enabled = false;

  async generateStructured<T>(): Promise<StructuredGenerationResult<T>> {
    throw new ProviderDisabledError();
  }
}

export class VercelGatewayNewsroomProvider implements NewsroomAiProvider {
  readonly code = "VERCEL_AI_GATEWAY";
  readonly enabled = true;

  async generateStructured<T>(request: StructuredGenerationRequest<T>) {
    if (!request.modelId.includes("/")) {
      throw new Error("AI Gateway model identifiers must use provider/model format.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const result = await generateText({
        model: request.modelId,
        output: Output.object({ schema: request.schema }),
        system: request.systemRules,
        prompt: request.sourceData,
        abortSignal: controller.signal,
        maxRetries: Math.min(Math.max(request.maxRetries, 0), 2),
        maxOutputTokens: request.maxOutputTokens,
        providerOptions: {
          gateway: {
            user: request.actorId,
            tags: request.tags,
            disallowPromptTraining: true,
          },
        },
      });
      return {
        output: result.output,
        providerCode: this.code,
        modelId: request.modelId,
        providerRequestId: result.response.id ?? null,
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          costMicros: gatewayCostMicros(result.providerMetadata),
        },
      } satisfies StructuredGenerationResult<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function gatewayCostMicros(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return 0;
  const gateway = (metadata as Record<string, unknown>).gateway;
  if (!gateway || typeof gateway !== "object") return 0;
  const value = (gateway as Record<string, unknown>).cost;
  const dollars = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(dollars) && dollars >= 0 ? Math.ceil(dollars * 1_000_000) : null;
}

export function createNewsroomProvider(configuration: {
  enabled: boolean;
  providerCode: string | null;
  configurationApproved: boolean;
  structuredOutputRequired?: boolean;
  webAccessEnabled?: boolean;
}): NewsroomAiProvider {
  if (!configuration.enabled || !configuration.configurationApproved) return new DisabledNewsroomProvider();
  if (configuration.structuredOutputRequired === false || configuration.webAccessEnabled === true) {
    throw new Error("Phase 5A requires strict structured output and forbids provider web access.");
  }
  if (configuration.providerCode === "VERCEL_AI_GATEWAY") {
    return new VercelGatewayNewsroomProvider();
  }
  throw new ProviderDisabledError();
}
