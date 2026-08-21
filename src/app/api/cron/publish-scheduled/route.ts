import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { sqlClient } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validSecret(request: Request, expected: string) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduled publishing is not activated." }, { status: 503 });
  if (!validSecret(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const published = await sqlClient<Array<{ id: string; urlPath: string }>>`
    update public.stories
    set status = 'PUBLISHED', published_at = coalesce(published_at, now()), scheduled_for = null
    where status = 'SCHEDULED'
      and scheduled_for <= now()
      and author_id is not null
      and primary_source_id is not null
      and jsonb_array_length(body) > 0
      and length(trim(summary)) >= 40
    returning id, url_path as "urlPath"
  `;

  for (const story of published) revalidatePath(story.urlPath);
  if (published.length) {
    revalidatePath("/news");
    revalidatePath("/search");
    revalidatePath("/sitemap.xml");
  }

  return NextResponse.json({ published: published.length });
}
