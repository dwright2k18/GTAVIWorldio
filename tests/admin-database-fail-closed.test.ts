import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  requireEditorAction: vi.fn(),
  revalidatePath: vi.fn(),
  values: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: mocks.insert,
  },
}));

vi.mock("@/lib/auth/dal", () => ({
  requireEditorAction: mocks.requireEditorAction,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { saveCategory } from "@/app/admin/(protected)/taxonomy/actions";

describe("authenticated newsroom database failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEditorAction.mockResolvedValue({ role: "EDITOR" });
    mocks.insert.mockReturnValue({ values: mocks.values });
  });

  it("propagates an unavailable database error and performs no post-mutation revalidation", async () => {
    const databaseError = Object.assign(new Error("Connection refused"), {
      code: "ECONNREFUSED",
    });
    mocks.values.mockRejectedValue(databaseError);
    const formData = new FormData();
    formData.set("code", "NEWS");
    formData.set("name", "News");
    formData.set("isIndexable", "on");
    formData.set("isActive", "on");

    await expect(saveCategory(null, formData)).rejects.toBe(databaseError);
    expect(mocks.requireEditorAction).toHaveBeenCalledWith([
      "OWNER",
      "ADMIN",
      "EDITOR",
    ]);
    expect(mocks.values).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
