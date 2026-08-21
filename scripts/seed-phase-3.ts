import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { stories as legacyStories } from "../src/data/content";
import {
  authors,
  categories,
  evergreenPages,
  sources,
  stories,
  storySources,
  storyTags,
  tags,
  type ArticleBodyBlock,
} from "../src/db/schema";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING is required to seed the CMS.");
}

const client = postgres(connectionString, { max: 1, prepare: false });
const database = drizzle(client);

const staffAuthorId = "10000000-0000-4000-8000-000000000001";
const officialSourceId = "20000000-0000-4000-8000-000000000001";
const standardsSourceId = "20000000-0000-4000-8000-000000000002";

const categoryRows = [
  ["NEWS", "news", "News", "Reported GTA VI developments."],
  ["ROCKSTAR", "rockstar", "Rockstar", "First-party Rockstar Games updates."],
  ["GAMEPLAY", "gameplay", "Gameplay", "Gameplay systems and official demonstrations."],
  ["CHARACTERS", "characters", "Characters", "Confirmed character reporting and guides."],
  ["MAP", "map", "Map", "World, location, and map coverage."],
  ["TRAILERS", "trailers", "Trailers", "Official trailer coverage and analysis."],
  ["VEHICLES", "vehicles", "Vehicles", "Confirmed and reported vehicle coverage."],
  ["ONLINE", "online", "Online", "Online-mode reporting and guides."],
  ["RUMORS", "rumors", "Rumors", "Clearly labeled reports, rumors, and claims."],
  ["GUIDES", "guides", "Guides", "Evidence-led reference material."],
  ["VIDEOS", "videos", "Videos", "Original GTAVIWorldio video coverage."],
] as const;

const categoryId = (index: number) =>
  `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

const legacyCategoryCodes = [
  "ROCKSTAR",
  "TRAILERS",
  "CHARACTERS",
  "CHARACTERS",
  "MAP",
  "MAP",
  "GUIDES",
  "RUMORS",
] as const;

const reviewInstructions = [
  "Source validation and freshness review required before any publication decision.",
  "Full fact check and rewrite review required; distinguish visible trailer details from interpretation.",
  "Fact check every character claim against approved first-party material; legacy byline removed.",
  "Fact check every character claim and remove unsupported theory; legacy byline removed.",
  "Source validation and update required; retain only clearly supported location details.",
  "Rewrite and fact check required; every map inference must remain clearly labeled.",
  "Rewrite and update required; avoid comparisons that imply unconfirmed gameplay facts.",
  "Editorial standards review required; this is methodology, not a breaking-news report.",
] as const;

const contentTypes = [
  "GUIDE",
  "ANALYSIS",
  "GUIDE",
  "GUIDE",
  "GUIDE",
  "ANALYSIS",
  "ANALYSIS",
  "FEATURE",
] as const;

const evergreenRows = [
  ["/release-date", "release-date", "GTA VI Release Date", "Find the latest confirmed GTA VI release-date information.", "A maintained reference for official release timing and meaningful changes."],
  ["/map", "map", "GTA VI Map", "Understand what is officially known about GTA VI locations and the map.", "An evidence-led guide to confirmed locations, recent developments, and unresolved questions."],
  ["/characters", "characters", "GTA VI Characters", "Explore confirmed GTA VI characters and reliable character information.", "A central guide to officially introduced characters and related reporting."],
  ["/characters/lucia", "lucia", "Lucia in GTA VI", "Find comprehensive, sourced information about Lucia.", "A maintained character reference separating official material from interpretation."],
  ["/characters/jason", "jason", "Jason in GTA VI", "Find comprehensive, sourced information about Jason.", "A maintained character reference separating official material from interpretation."],
  ["/gameplay", "gameplay", "GTA VI Gameplay", "Understand confirmed GTA VI gameplay information.", "A source-led overview of gameplay information shown or described by first-party sources."],
  ["/trailers", "trailers", "GTA VI Trailers", "Watch and understand official GTA VI trailers and their confirmed details.", "A chronological reference for official trailers, source links, and related analysis."],
  ["/vehicles", "vehicles", "GTA VI Vehicles", "Find confirmed and carefully sourced GTA VI vehicle information.", "A maintained reference for vehicles visible or described in approved sources."],
  ["/online", "online", "GTA VI Online", "Find what has and has not been confirmed about GTA VI online play.", "A cautious reference that separates official online information from expectations and rumor."],
  ["/news", "news", "Latest GTA VI News", "See the latest verified and clearly labeled GTA VI reporting.", "The primary chronological archive for GTAVIWorldio reporting."],
  ["/rumors", "rumors", "GTA VI Rumors & Reports", "Evaluate significant GTA VI rumors with clear sourcing and verification labels.", "A controlled hub for credible reports, rumors, speculation, and alleged leaks."],
] as const;

function articleBody(storyIndex: number): ArticleBodyBlock[] {
  return legacyStories[storyIndex].article.map((block) => {
    if (block.type === "heading") {
      return { type: "heading" as const, level: 2 as const, content: block.content };
    }

    return block;
  });
}

function plainText(storyIndex: number) {
  return legacyStories[storyIndex].article
    .flatMap((block) =>
      block.type === "list" ? block.items : [block.content],
    )
    .join("\n\n");
}

async function main() {
  try {
    await database.transaction(async (tx) => {
    await tx
      .insert(authors)
      .values({
        id: staffAuthorId,
        slug: "gtaviworldio-staff",
        name: "GTAVIWorldio Staff",
        bio: "The GTAVIWorldio editorial team reports and reviews GTA VI developments using the publication's verification standards.",
        role: "Editorial team",
        expertiseAreas: ["GTA VI", "Rockstar Games", "source verification"],
      })
      .onConflictDoUpdate({
        target: authors.id,
        set: { name: "GTAVIWorldio Staff", isActive: true },
      });

    for (const [index, row] of categoryRows.entries()) {
      const [code, slug, name, description] = row;
      await tx
        .insert(categories)
        .values({ id: categoryId(index), code, slug, name, description })
        .onConflictDoUpdate({
          target: categories.id,
          set: { code, slug, name, description, isActive: true },
        });
    }

    await tx
      .insert(sources)
      .values({
        id: officialSourceId,
        name: "Rockstar Games — Grand Theft Auto VI",
        url: "https://www.rockstargames.com/VI",
        sourceType: "FIRST_PARTY",
        publication: "Rockstar Games",
        isFirstParty: true,
        verificationNotes: "Primary official material; each migrated claim still requires source-level review.",
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: { isFirstParty: true, sourceType: "FIRST_PARTY" },
      });

    await tx
      .insert(sources)
      .values({
        id: standardsSourceId,
        name: "GTAVIWorldio verification standard",
        url: "https://gtaviworld.io/verification",
        sourceType: "OTHER",
        publication: "GTAVIWorldio",
        isFirstParty: false,
        verificationNotes: "Internal editorial methodology, not evidence for an external factual claim.",
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: { verificationNotes: "Internal editorial methodology, not evidence for an external factual claim." },
      });

    const allTagNames = Array.from(
      new Set(legacyStories.flatMap((story) => story.tags)),
    ).sort();
    const tagIds = new Map<string, string>();

    for (const [index, tagName] of allTagNames.entries()) {
      const id = `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      const slug = tagName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      tagIds.set(tagName, id);
      await tx
        .insert(tags)
        .values({ id, slug, name: tagName, isIndexable: false })
        .onConflictDoUpdate({ target: tags.id, set: { slug, name: tagName } });
    }

    for (const [index, legacyStory] of legacyStories.entries()) {
      const id = `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      const categoryCode = legacyCategoryCodes[index];
      const categoryIndex = categoryRows.findIndex(([code]) => code === categoryCode);
      const primarySourceId = index === 7 ? standardsSourceId : officialSourceId;
      const discoveredAt = new Date(legacyStory.dateDiscovered);

      await tx
        .insert(stories)
        .values({
          id,
          headline: legacyStory.headline,
          slug: legacyStory.slug,
          urlPath: `/news/${legacyStory.slug}`,
          summary: legacyStory.summary,
          body: articleBody(index),
          bodyText: plainText(index),
          contentType: contentTypes[index],
          categoryId: categoryId(categoryIndex),
          verificationStatus: legacyStory.verification.replace(" ", "_") as
            | "CONFIRMED"
            | "CREDIBLE_REPORT"
            | "RUMOR"
            | "SPECULATION"
            | "ALLEGED_LEAK",
          status: index === 1 || index === 3 || index === 5 ? "FACT_CHECK" : "NEEDS_REVIEW",
          authorId: staffAuthorId,
          primarySourceId,
          discoveredAt,
          heroImageAlt: legacyStory.heroMedia.alt,
          internalNotes: `${reviewInstructions[index]} Migrated from pre-launch static record ${legacyStory.storyId}. Do not publish without editor approval.`,
        })
        .onConflictDoUpdate({
          target: stories.id,
          set: {
            status: index === 1 || index === 3 || index === 5 ? "FACT_CHECK" : "NEEDS_REVIEW",
            internalNotes: `${reviewInstructions[index]} Migrated from pre-launch static record ${legacyStory.storyId}. Do not publish without editor approval.`,
          },
        });

      await tx
        .insert(storySources)
        .values({
          storyId: id,
          sourceId: primarySourceId,
          isPrimary: true,
          evidenceNotes: legacyStory.source.note,
        })
        .onConflictDoNothing();

      for (const tagName of legacyStory.tags) {
        const tagId = tagIds.get(tagName);
        if (tagId) {
          await tx
            .insert(storyTags)
            .values({ storyId: id, tagId })
            .onConflictDoNothing();
        }
      }
    }

    for (const [index, row] of evergreenRows.entries()) {
      const [path, slug, title, searchIntent, summary] = row;
      await tx
        .insert(evergreenPages)
        .values({
          id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          path,
          slug,
          title,
          searchIntent,
          summary,
          status: "NEEDS_REVIEW",
          authorId: staffAuthorId,
        })
        .onConflictDoUpdate({
          target: evergreenPages.id,
          set: { title, searchIntent, summary, status: "NEEDS_REVIEW" },
        });
    }
    });

    console.log("Seeded 8 review-only stories, 11 controlled categories, and 11 evergreen drafts.");
  } finally {
    await client.end();
  }
}

void main();
