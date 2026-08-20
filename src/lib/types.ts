export const verificationStatuses = [
  "CONFIRMED",
  "CREDIBLE REPORT",
  "RUMOR",
  "SPECULATION",
  "ALLEGED LEAK",
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export type StoryCategory =
  | "Official"
  | "Analysis"
  | "Characters"
  | "World"
  | "Gameplay"
  | "Community";

export type ArticleBlock =
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "quote"; content: string }
  | { type: "list"; items: string[] };

export type EditorialMedia = {
  alt: string;
  label: string;
  gradient: string;
  accent: string;
  src?: string;
  focalPoint?: string;
  credit?: string;
};

export type EditorialVideo = {
  src: string;
  mimeType?: "video/mp4" | "video/webm";
  poster?: string;
  captions?: string;
};

export type StorySource = {
  name: string;
  url: string;
  note: string;
};

export type SocialLinks = Partial<{
  tiktok: string;
  youtube: string;
  instagram: string;
  facebook: string;
}>;

export type Story = {
  storyId: string;
  headline: string;
  slug: string;
  summary: string;
  article: ArticleBlock[];
  category: StoryCategory;
  verification: VerificationStatus;
  source: StorySource;
  dateDiscovered: string;
  datePublished: string;
  dateUpdated: string;
  author: string;
  readingMinutes: number;
  heroMedia: EditorialMedia;
  tags: string[];
  relatedStoryIds: string[];
  relatedVideoIds: string[];
  social: SocialLinks;
  metrics: {
    views: number;
    engagement: number;
    trendingScore: number;
  };
};

export type QuickHit = {
  videoId: string;
  storyId: string;
  headline: string;
  slug: string;
  category: StoryCategory;
  verification: VerificationStatus;
  publishedAt: string;
  durationSeconds: 13;
  media: EditorialMedia;
  video?: EditorialVideo;
  social: SocialLinks;
  metrics: {
    views: number;
    engagement: number;
    viralScore: number;
  };
};
