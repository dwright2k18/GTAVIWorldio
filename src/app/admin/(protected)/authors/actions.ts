"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { authors } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";
import { slugifyHeadline } from "@/lib/cms/seo";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(3_000).optional(),
  role: z.string().trim().max(120).optional(),
  profileImageUrl: z.union([z.url(), z.literal("")]).optional(),
  profileImageAlt: z.string().trim().max(300).optional(),
  expertiseAreas: z.string().trim().max(1_000).optional(),
  socialLinks: z.string().trim().max(2_000).optional(),
  isActive: z.preprocess((value) => value === "on", z.boolean()),
});

function parseSocialLinks(value?: string) {
  if (!value) return {};
  return Object.fromEntries(
    value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const separator = line.indexOf("=");
      if (separator < 1) throw new Error("Social links must use platform=https://… format.");
      const platform = line.slice(0, separator).trim().toLowerCase();
      const url = z.url().parse(line.slice(separator + 1).trim());
      return [platform, url];
    }),
  );
}

export async function saveAuthor(authorId: string | null, formData: FormData) {
  await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = schema.parse(Object.fromEntries(formData.entries()));
  const values = {
    name: input.name,
    slug: slugifyHeadline(input.slug || input.name),
    bio: input.bio || null,
    role: input.role || null,
    profileImageUrl: input.profileImageUrl || null,
    profileImageAlt: input.profileImageAlt || null,
    expertiseAreas: input.expertiseAreas ? input.expertiseAreas.split(",").map((item) => item.trim()).filter(Boolean) : [],
    socialLinks: parseSocialLinks(input.socialLinks),
    isActive: input.isActive,
  };
  if (authorId) await db.update(authors).set(values).where(eq(authors.id, z.uuid().parse(authorId)));
  else await db.insert(authors).values(values);
  revalidatePath("/admin/authors");
}
