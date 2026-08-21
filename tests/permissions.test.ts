import { describe, expect, it } from "vitest";

import { storyMutationDenial } from "@/lib/auth/permissions";

const authorId = "11111111-1111-4111-8111-111111111111";
const otherEditorId = "22222222-2222-4222-8222-222222222222";

describe("application newsroom permissions", () => {
  it("allows an author to edit their own draft and submit it for review", () => {
    expect(
      storyMutationDenial("AUTHOR", authorId, "review", {
        createdBy: authorId,
        status: "DRAFTING",
      }),
    ).toBeNull();
  });

  it("blocks an author from editing another editor's story", () => {
    expect(
      storyMutationDenial("AUTHOR", authorId, "save", {
        createdBy: otherEditorId,
        status: "DRAFTING",
      }),
    ).toMatch(/only edit stories they created/i);
  });

  it("blocks an author from publishing or editing a post-review story", () => {
    expect(storyMutationDenial("AUTHOR", authorId, "publish")).toMatch(/cannot advance/i);
    expect(
      storyMutationDenial("AUTHOR", authorId, "save", {
        createdBy: authorId,
        status: "FACT_CHECK",
      }),
    ).toMatch(/beyond the author editing stage/i);
  });

  it("limits fact checkers to existing stories in the review queue", () => {
    expect(storyMutationDenial("FACT_CHECKER", authorId, "save")).toMatch(/cannot create/i);
    expect(
      storyMutationDenial("FACT_CHECKER", authorId, "fact-check", {
        createdBy: otherEditorId,
        status: "NEEDS_REVIEW",
      }),
    ).toBeNull();
    expect(
      storyMutationDenial("FACT_CHECKER", authorId, "publish", {
        createdBy: otherEditorId,
        status: "FACT_CHECK",
      }),
    ).toMatch(/cannot approve, schedule, publish, or archive/i);
  });

  it("keeps the approved editor workflow available", () => {
    expect(
      storyMutationDenial("EDITOR", authorId, "publish", {
        createdBy: otherEditorId,
        status: "APPROVED",
      }),
    ).toBeNull();
  });
});
