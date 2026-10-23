import type { z } from "zod";

import { hashPayload } from "@/lib/grok-worker/crypto";
import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  idempotencyKeyFrom,
  leaseTokenFrom,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";
import {
  artifactSchemas,
  artifactSubmissionEnvelopeSchema,
  grokArtifactKindSchema,
} from "@/lib/grok-worker/schemas";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "artifact:submit",
    );
    const { id, kind: rawKind } = await context.params;
    const kind = grokArtifactKindSchema.parse(rawKind);
    const body = artifactSubmissionEnvelopeSchema.parse(
      await readJsonBody(request),
    );
    const payload = (artifactSchemas[kind] as z.ZodType).parse(body.payload) as Record<
      string,
      unknown
    >;
    const input = { ...body, payload, artifactKind: kind };
    return replayOrRun(
      request,
      principal,
      `artifact:${id}:${kind}`,
      input,
      async () => {
        const submission = await grokRepository.submitArtifact({
          workItemId: id,
          principal,
          leaseToken: leaseTokenFrom(request),
          artifactKind: kind,
          schemaVersion: body.schemaVersion,
          revision: body.revision,
          inputSnapshotHash: body.inputSnapshotHash,
          payload,
          payloadHash: hashPayload(payload),
          idempotencyKey: idempotencyKeyFrom(request),
        });
        await grokRepository.appendAudit({
          principal,
          workItemId: id,
          action: "GROK_ARTIFACT_ACCEPTED",
          requestId,
          requestHash: hashPayload(input),
          outcome: "ACCEPTED",
          metadata: { artifactKind: kind, revision: body.revision },
        });
        return {
          status: 201,
          body: {
            submissionId: submission.id,
            artifactKind: kind,
            revision: body.revision,
            payloadHash: hashPayload(payload),
            acceptedAt: submission.createdAt,
          },
        };
      },
    );
  } catch (error) {
    return grokErrorResponse(error);
  }
}
