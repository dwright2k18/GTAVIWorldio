import { describe, expect, it } from "vitest";

import { discoveryPermissionDenial } from "@/lib/auth/discovery-permissions";

describe("discovery role permissions", () => {
  it("gives owners and administrators full discovery management", () => {
    expect(discoveryPermissionDenial("OWNER", "MANAGE_SETTINGS")).toBeNull();
    expect(discoveryPermissionDenial("ADMIN", "PROMOTE_TO_DRAFT")).toBeNull();
  });

  it("allows editors to manage candidates but not automation limits", () => {
    expect(discoveryPermissionDenial("EDITOR", "PROMOTE_TO_DRAFT")).toBeNull();
    expect(discoveryPermissionDenial("EDITOR", "MANAGE_SETTINGS")).toMatch(/owners and administrators/i);
    expect(discoveryPermissionDenial("EDITOR", "MANAGE_SOURCES")).toMatch(/owners and administrators/i);
  });

  it("limits fact checkers to evidence and verification", () => {
    expect(discoveryPermissionDenial("FACT_CHECKER", "VERIFY")).toBeNull();
    expect(discoveryPermissionDenial("FACT_CHECKER", "ADD_EVIDENCE")).toBeNull();
    expect(discoveryPermissionDenial("FACT_CHECKER", "PROMOTE_TO_DRAFT")).toMatch(/cannot/i);
    expect(discoveryPermissionDenial("FACT_CHECKER", "REJECT")).toMatch(/cannot/i);
  });

  it("limits authors to assigned or promoted research", () => {
    expect(discoveryPermissionDenial("AUTHOR", "VIEW", { assignedOrPromoted: true })).toBeNull();
    expect(discoveryPermissionDenial("AUTHOR", "ADD_EVIDENCE", { assignedOrPromoted: true })).toBeNull();
    expect(discoveryPermissionDenial("AUTHOR", "VIEW")).toMatch(/assigned or promoted/i);
    expect(discoveryPermissionDenial("AUTHOR", "PROMOTE_TO_DRAFT", { assignedOrPromoted: true })).toMatch(/only view/i);
  });
});
