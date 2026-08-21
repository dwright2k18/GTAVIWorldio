"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";

const optionalUrl = z.union([z.url(), z.literal("")]).optional();
const optionalInteger = z.preprocess((value) => value === "" ? null : Number(value), z.number().int().positive().nullable());
const schema = z.object({
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
  url: z.url(),
  altText: z.string().trim().max(500).optional(),
  caption: z.string().trim().max(1_000).optional(),
  credit: z.string().trim().max(500).optional(),
  sourceUrl: optionalUrl,
  licenseNotes: z.string().trim().max(2_000).optional(),
  width: optionalInteger,
  height: optionalInteger,
  mimeType: z.string().trim().max(100).optional(),
  focalPoint: z.string().trim().max(80).optional(),
});

export async function saveMedia(mediaId: string | null, formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = schema.parse(Object.fromEntries(formData.entries()));
  const assetHost = new URL(input.url).hostname;
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : null;
  if (!["gtaviworld.io", "www.gtaviworld.io", supabaseHost].includes(assetHost)) {
    throw new Error("Copy approved assets to GTAVIWorldio or its Supabase storage before adding them to the media library.");
  }
  if (input.mediaType === "IMAGE" && (!input.altText || !input.width || !input.height)) {
    throw new Error("Editorial images require alt text, width, and height.");
  }
  const values = { ...input, altText: input.altText || null, caption: input.caption || null, credit: input.credit || null, sourceUrl: input.sourceUrl || null, licenseNotes: input.licenseNotes || null, mimeType: input.mimeType || null, focalPoint: input.focalPoint || null };
  if (mediaId) await db.update(mediaAssets).set(values).where(eq(mediaAssets.id, z.uuid().parse(mediaId)));
  else await db.insert(mediaAssets).values({ ...values, createdBy: editor.id });
  revalidatePath("/admin/media");
}
