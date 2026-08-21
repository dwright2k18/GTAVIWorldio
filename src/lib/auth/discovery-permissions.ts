import type { EditorRole } from "./dal";

export type DiscoveryAction =
  | "VIEW"
  | "TRIAGE"
  | "RESEARCH"
  | "VERIFY"
  | "PROMOTE_TO_DRAFT"
  | "REJECT"
  | "MERGE"
  | "ADD_EVIDENCE"
  | "MANAGE_SOURCES"
  | "MANAGE_SETTINGS";

export function discoveryPermissionDenial(
  role: EditorRole,
  action: DiscoveryAction,
  options: { assignedOrPromoted?: boolean } = {},
) {
  if (["OWNER", "ADMIN"].includes(role)) return null;
  if (role === "EDITOR") {
    return ["MANAGE_SETTINGS", "MANAGE_SOURCES"].includes(action)
      ? "Only owners and administrators can manage sources or automation limits."
      : null;
  }
  if (role === "FACT_CHECKER") {
    return ["VIEW", "VERIFY", "ADD_EVIDENCE"].includes(action)
      ? null
      : "Fact checkers can review evidence and verification but cannot triage, reject, merge, or promote candidates.";
  }
  if (action === "VIEW" && options.assignedOrPromoted) return null;
  if (action === "ADD_EVIDENCE" && options.assignedOrPromoted) return null;
  return "Authors can only view assigned or promoted research and add supporting evidence.";
}

export function canManageDiscovery(role: EditorRole) {
  return discoveryPermissionDenial(role, "TRIAGE") === null;
}

export function canVerifyDiscovery(role: EditorRole) {
  return discoveryPermissionDenial(role, "VERIFY") === null;
}
