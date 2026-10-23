import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";
import { workExceptionSchema } from "@/lib/grok-worker/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "exception:write",
    );
    const { id } = await context.params;
    const body = workExceptionSchema.parse(await readJsonBody(request));
    return replayOrRun(
      request,
      principal,
      `work:${id}:exception`,
      body,
      async () => {
        const alert = await grokRepository.reportException({
          workItemId: id,
          principal,
          leaseToken: leaseTokenFrom(request),
          ...body,
        });
        await grokRepository.appendAudit({
          principal,
          workItemId: id,
          action: "GROK_EXCEPTION_REPORTED",
          requestId,
          outcome: "ALERT_CREATED",
          metadata: { alertId: alert.id, code: body.code, severity: body.severity },
        });
        return { status: 201, body: { alertId: alert.id, status: "NEW" } };
      },
    );
  } catch (error) {
    return grokErrorResponse(error);
  }
}
