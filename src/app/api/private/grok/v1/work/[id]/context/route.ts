import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
} from "@/lib/grok-worker/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal } = await authorizeGrokRequest(
      request,
      "candidate:read-leased",
    );
    const { id } = await context.params;
    const result = await grokRepository.loadContext(
      id,
      principal.workerId,
      leaseTokenFrom(request),
    );
    return Response.json(result, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return grokErrorResponse(error);
  }
}
