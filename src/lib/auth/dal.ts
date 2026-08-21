import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { editorProfiles, type EditorProfile } from "@/db/schema";
import { VERIFIED_EDITOR_HEADER } from "@/lib/auth/constants";

export type EditorRole = EditorProfile["role"];

export const getCurrentEditor = cache(async () => {
  const userId = (await headers()).get(VERIFIED_EDITOR_HEADER);

  if (!userId) {
    return null;
  }

  const [editor] = await db
    .select()
    .from(editorProfiles)
    .where(eq(editorProfiles.authUserId, userId))
    .limit(1);

  return editor?.isActive ? editor : null;
});

export async function requireEditor(roles?: readonly EditorRole[]) {
  const editor = await getCurrentEditor();

  if (!editor) {
    redirect("/admin/login");
  }

  if (roles && !roles.includes(editor.role)) {
    redirect("/admin?notice=insufficient-role");
  }

  return editor;
}

export async function requireEditorAction(roles?: readonly EditorRole[]) {
  const editor = await getCurrentEditor();

  if (!editor) {
    throw new Error("Authentication required.");
  }

  if (roles && !roles.includes(editor.role)) {
    throw new Error("Your newsroom role does not allow this action.");
  }

  return editor;
}
