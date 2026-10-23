import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";
import { releaseWorkSchema } from "@/lib/grok-worker/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "queue:lease",
    );
    const { id } = await context.params;
    const body = releaseWorkSchema.parse(await readJsonBody(request));
    return replayOrRun(
      request,
      principal,
      `work:${id}:release`,
      body,
      async () => {
        const result = await grokRepository.releaseWork(
          id,
          principal.workerId,
          leaseTokenFrom(request),
          body.reason,
          body.retryAfterSeconds,
        );
        await grokRepository.appendAudit({
          principal,
          workItemId: id,
          candidateId: result.candidateId,
          action: "GROK_WORK_RELEASED",
          requestId,
          outcome: "READY",
          metadata: { retryAfterSeconds: body.retryAfterSeconds },
        });
        return { status: 200, body: { status: "READY" } };
      },
    );
  } catch (error) {
    return grokErrorResponse(error);
  }
}
