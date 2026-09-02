import type { EditorRole } from "./dal";

export type AiNewsroomAction =
  | "VIEW"
  | "GENERATE_RESEARCH"
  | "GENERATE_DRAFT"
  | "EDIT_ASSIGNED_DRAFT"
  | "REVIEW_CLAIM"
  | "RUN_GROUNDING"
  | "REVIEW_SEO"
  | "REQUEST_REVISION"
  | "SEND_TO_FACT_CHECK"
  | "MARK_NEEDS_REVIEW"
  | "REJECT_OUTPUT"
  | "VIEW_COST"
  | "CONFIGURE_PROVIDER";

export function aiPermissionDenial(
  role: EditorRole,
  action: AiNewsroomAction,
  options: { assigned?: boolean } = {},
) {
  if (["OWNER", "ADMIN"].includes(role)) return null;
  if (role === "EDITOR") {
    return action === "CONFIGURE_PROVIDER"
      ? "Only owners and administrators can configure providers or global AI budgets."
      : null;
  }
  if (role === "FACT_CHECKER") {
    return ["VIEW", "REVIEW_CLAIM", "RUN_GROUNDING", "REQUEST_REVISION", "SEND_TO_FACT_CHECK", "REJECT_OUTPUT"].includes(action)
      ? null
      : "Fact checkers may review evidence and grounding but cannot generate, configure, or advance AI drafts.";
  }
  if (role === "AUTHOR" && options.assigned) {
    return ["VIEW", "EDIT_ASSIGNED_DRAFT", "REQUEST_REVISION"].includes(action)
      ? null
      : "Authors may only view and edit their assigned private draft material.";
  }
  return "This newsroom role is not permitted to perform the requested AI action.";
}
