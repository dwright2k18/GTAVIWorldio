"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { sources } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";

const schema = z.object({
  name: z.string().trim().min(2).max(180),
  url: z.url(),
  sourceType: z.enum(["FIRST_PARTY", "PRESS_RELEASE", "INVESTOR_REPORT", "INTERVIEW", "JOURNALISM", "PUBLIC_RECORD", "COMMUNITY_DISCOVERY", "SOCIAL_POST", "OTHER"]),
  publication: z.string().trim().max(180).optional(),
  authorName: z.string().trim().max(180).optional(),
  sourcePublishedAt: z.string().optional(),
  isFirstParty: z.preprocess((value) => value === "on", z.boolean()),
  reliabilityNotes: z.string().trim().max(10_000).optional(),
  verificationNotes: z.string().trim().max(10_000).optional(),
});

export async function saveSource(sourceId: string | null, formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR", "FACT_CHECKER"]);
  const input = schema.parse(Object.fromEntries(formData.entries()));
  const publishedDate = input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null;
  if (publishedDate && Number.isNaN(publishedDate.valueOf())) throw new Error("Source date is invalid.");
  const values = {
    ...input,
    publication: input.publication || null,
    authorName: input.authorName || null,
    sourcePublishedAt: publishedDate,
    reliabilityNotes: input.reliabilityNotes || null,
    verificationNotes: input.verificationNotes || null,
  };

  if (sourceId) {
    await db.update(sources).set(values).where(eq(sources.id, z.uuid().parse(sourceId)));
  } else {
    await db.insert(sources).values({ ...values, createdBy: editor.id });
  }
  revalidatePath("/admin/sources");
}
