import {
  authorizeGrokRequest,
  grokErrorResponse,
  grokRepository,
  leaseTokenFrom,
  readJsonBody,
  replayOrRun,
} from "@/lib/grok-worker/http";
import { validateWorkerPublicationBundle } from "@/lib/grok-worker/validation";
import { attemptAutomaticPublication } from "@/lib/grok-worker/publication";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { principal, requestId } = await authorizeGrokRequest(
      request,
      "artifact:submit",
    );
    const { id } = await context.params;
    const body = await readJsonBody(request);
    return replayOrRun(
      request,
      principal,
      `work:${id}:validate`,
      body,
      async () => {
        const validationContext = await grokRepository.loadValidationContext(
          id,
          principal.workerId,
          leaseTokenFrom(request),
        );
        const validation = validateWorkerPublicationBundle(validationContext);
        if (!validation.complete) {
          return {
            status: 422,
            body: {
              status: "INCOMPLETE",
              missingArtifacts: validation.missing,
            },
          };
        }
        await grokRepository.recordValidationRuns(
          validationContext.candidate.id,
          validation.results,
        );
        const passed = validation.results.every((result) => result.passed);
        const publication = passed
          ? await attemptAutomaticPublication(
              grokRepository,
              validationContext.candidate.id,
              { principal, workItemId: id, requestId },
            )
          : {
              decision: "BLOCKED" as const,
              published: false,
              failed: [
                {
                  gate: "serverValidation",
                  reason: "One or more server validations failed.",
                },
              ],
            };
        await grokRepository.appendAudit({
          principal,
          workItemId: id,
          candidateId: validationContext.candidate.id,
          action: "GROK_SERVER_VALIDATION",
          requestId,
          outcome: passed ? "PASSED" : "NEEDS_HUMAN_REVIEW",
          metadata: {
            validators: validation.results.map((result) => ({
              type: result.validationType,
              passed: result.passed,
            })),
            publicationDecision: publication.decision,
          },
        });
        return {
          status: 200,
          body: {
            status: passed ? "PASSED" : "NEEDS_HUMAN_REVIEW",
            validations: validation.results.map((result) => ({
              type: result.validationType,
              passed: result.passed,
              findings: result.findings,
            })),
            publication,
          },
        };
      },
    );
  } catch (error) {
    return grokErrorResponse(error);
  }
}
