import { grokTokenPepper } from "@/lib/grok-worker/config";
import { deriveLeaseToken, hashPayload } from "@/lib/grok-worker/crypto";
import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "queue:lease",
    );
    const body = await readJsonBody(request);
    return replayOrRun(request, principal, "queue:lease", body, async (recordId) => {
      const leaseToken = deriveLeaseToken(
        `${principal.credentialId}:${recordId}`,
        grokTokenPepper(),
      );
      const work = await grokRepository.leaseWork(principal, leaseToken);
      await grokRepository.appendAudit({
        principal,
        workItemId: work?.work_item_id,
        candidateId: work?.candidate_id,
        action: "GROK_QUEUE_LEASE",
        requestId,
        requestHash: hashPayload(body),
        outcome: work ? "LEASED" : "EMPTY",
      });
      const responseBody = work
        ? {
            workItem: {
              id: work.work_item_id,
              candidateId: work.candidate_id,
              kind: work.kind,
              revision: work.revision,
              inputSnapshotHash: work.input_snapshot_hash,
              leaseExpiresAt: work.lease_expires_at,
            },
            leaseToken,
          }
        : { workItem: null };
      return {
        status: 200,
        body: responseBody,
        storedBody: work
          ? { ...responseBody, leaseToken: "REDACTED" }
          : responseBody,
      };
    }, {
      hydrateReplay: (storedBody, recordId) =>
        storedBody.workItem
          ? {
              ...storedBody,
              leaseToken: deriveLeaseToken(
                `${principal.credentialId}:${recordId}`,
                grokTokenPepper(),
              ),
            }
          : storedBody,
    });
  } catch (error) {
    return grokErrorResponse(error);
  }
}
