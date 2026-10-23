import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "job:complete",
    );
    const { id } = await context.params;
    const body = await readJsonBody(request);
    return replayOrRun(
      request,
      principal,
      `work:${id}:complete`,
      body,
      async () => {
        const result = await grokRepository.completeWork(
          id,
          principal.workerId,
          leaseTokenFrom(request),
        );
        await grokRepository.appendAudit({
          principal,
          workItemId: id,
          candidateId: result.candidateId,
          action: "GROK_WORK_COMPLETED",
          requestId,
          outcome: "COMPLETED_PRIVATE",
          metadata: { publicationAttempted: false },
        });
        return {
          status: 200,
          body: {
            status: "COMPLETED",
            publicationAttempted: false,
            message:
              "Artifacts remain private until server validation and publication policy evaluation complete.",
          },
        };
      },
    );
  } catch (error) {
    return grokErrorResponse(error);
  }
}
