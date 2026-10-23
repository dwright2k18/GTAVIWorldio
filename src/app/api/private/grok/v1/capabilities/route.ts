import {
  authorizeGrokRequest,
  grokErrorResponse,
} from "@/lib/grok-worker/http";
import { grokArtifactKinds, grokScopes } from "@/lib/grok-worker/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeGrokRequest(request, "worker:status");
    return Response.json({
      apiVersion: "grok-worker-v1",
      artifactKinds: grokArtifactKinds,
      availableScopes: grokScopes,
      directPublication: false,
      browserClicksRequired: false,
    });
  } catch (error) {
    return grokErrorResponse(error);
  }
}
