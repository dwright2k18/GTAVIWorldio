import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
} from "@/lib/grok-worker/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal } = await authorizeGrokRequest(request, "queue:lease");
    const { id } = await context.params;
    const updated = await grokRepository.heartbeat(
      id,
      principal.workerId,
      leaseTokenFrom(request),
    );
    return Response.json({ leaseExpiresAt: updated.expiresAt });
  } catch (error) {
    return grokErrorResponse(error);
  }
}
