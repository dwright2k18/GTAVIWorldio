"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { categories, tags } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";
import { slugifyHeadline } from "@/lib/cms/seo";

const checkbox = z.preprocess((value) => value === "on", z.boolean());
const categorySchema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "_")),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  parentCode: z.string().trim().max(40).optional(),
  isIndexable: checkbox,
  isActive: checkbox,
});
const tagSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  isIndexable: checkbox,
  isActive: checkbox,
});

export async function saveCategory(categoryId: string | null, formData: FormData) {
  await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = categorySchema.parse(Object.fromEntries(formData.entries()));
  const values = { ...input, slug: slugifyHeadline(input.slug || input.name), description: input.description || null, parentCode: input.parentCode || null };
  if (categoryId) await db.update(categories).set(values).where(eq(categories.id, z.uuid().parse(categoryId)));
  else await db.insert(categories).values(values);
  revalidatePath("/admin/taxonomy");
}

export async function saveTag(tagId: string | null, formData: FormData) {
  await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = tagSchema.parse(Object.fromEntries(formData.entries()));
  const values = { ...input, slug: slugifyHeadline(input.slug || input.name), description: input.description || null };
  if (tagId) await db.update(tags).set(values).where(eq(tags.id, z.uuid().parse(tagId)));
  else await db.insert(tags).values(values);
  revalidatePath("/admin/taxonomy");
}
