import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { editorProfiles, type EditorProfile } from "@/db/schema";
import { VERIFIED_EDITOR_HEADER } from "@/lib/auth/constants";

export type EditorRole = EditorProfile["role"];

export type EditorAccess =
  | { status: "UNAUTHENTICATED"; editor: null }
  | { status: "INACTIVE"; editor: null }
  | { status: "ACTIVE"; editor: EditorProfile };

export const getCurrentEditorAccess = cache(async (): Promise<EditorAccess> => {
  const userId = (await headers()).get(VERIFIED_EDITOR_HEADER);

  if (!userId) {
    return { status: "UNAUTHENTICATED", editor: null };
  }

  const [editor] = await db
    .select()
    .from(editorProfiles)
    .where(eq(editorProfiles.authUserId, userId))
    .limit(1);

  if (!editor?.isActive) {
    return { status: "INACTIVE", editor: null };
  }

  return { status: "ACTIVE", editor };
});

export const getCurrentEditor = cache(async () => {
  const access = await getCurrentEditorAccess();
  return access.status === "ACTIVE" ? access.editor : null;
});

export async function requireEditor(roles?: readonly EditorRole[]) {
  const access = await getCurrentEditorAccess();

  if (access.status === "UNAUTHENTICATED") {
    redirect("/admin/login");
  }

  if (access.status === "INACTIVE") {
    redirect("/admin/access-denied");
  }

  const editor = access.editor;

  if (roles && !roles.includes(editor.role)) {
    redirect("/admin?notice=insufficient-role");
  }

  return editor;
}

export async function requireEditorAction(roles?: readonly EditorRole[]) {
  const access = await getCurrentEditorAccess();

  if (access.status !== "ACTIVE") {
    throw new Error("Authentication required.");
  }

  const editor = access.editor;

  if (roles && !roles.includes(editor.role)) {
    throw new Error("Your newsroom role does not allow this action.");
  }

  return editor;
}
