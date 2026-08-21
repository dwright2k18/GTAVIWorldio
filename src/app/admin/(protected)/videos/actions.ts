"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { videos } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";

const optionalUrl = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : null, z.url().nullable());
const optionalUuid = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : null, z.uuid().nullable());
const schema = z.object({
  kind: z.enum(["PRIMARY", "QUICK_HIT", "TRAILER", "CLIP"]),
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().max(2_000).optional(),
  thumbnailMediaId: optionalUuid,
  durationSeconds: z.preprocess((value) => value === "" ? null : Number(value), z.number().int().positive().nullable()),
  platform: z.string().trim().max(80).optional(),
  embedUrl: optionalUrl,
  contentUrl: optionalUrl,
  transcript: z.string().trim().max(100_000).optional(),
  captionsUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  isPublished: z.preprocess((value) => value === "on", z.boolean()),
});

export async function saveVideo(videoId: string | null, formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = schema.parse(Object.fromEntries(formData.entries()));
  if (input.kind === "QUICK_HIT" && input.durationSeconds !== 13) throw new Error("Quick Hits must use the approved 13-second format.");
  if (input.isPublished && (!input.thumbnailMediaId || !input.durationSeconds || !input.contentUrl)) throw new Error("Published video records require thumbnail, duration, and content URL.");
  const values = { ...input, description: input.description || null, platform: input.platform || null, transcript: input.transcript || null };
  if (videoId) await db.update(videos).set(values).where(eq(videos.id, z.uuid().parse(videoId)));
  else await db.insert(videos).values({ ...values, createdBy: editor.id });
  revalidatePath("/admin/videos");
}
