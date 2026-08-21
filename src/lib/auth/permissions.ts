import type { EditorProfile, StoryRecord } from "@/db/schema";
import type { StoryInput } from "@/lib/cms/validation";

type EditorRole = EditorProfile["role"];
type ExistingStoryAccess = Pick<StoryRecord, "createdBy" | "status">;

const authorEditableStatuses: readonly StoryRecord["status"][] = [
  "DISCOVERED",
  "RESEARCHING",
  "DRAFTING",
  "NEEDS_REVIEW",
];
const factCheckerEditableStatuses: readonly StoryRecord["status"][] = [
  "NEEDS_REVIEW",
  "FACT_CHECK",
];

export function storyMutationDenial(
  role: EditorRole,
  editorId: string,
  intent: StoryInput["intent"],
  existing?: ExistingStoryAccess,
) {
  if (["OWNER", "ADMIN", "EDITOR"].includes(role)) {
    return null;
  }

  if (role === "AUTHOR") {
    if (!["save", "review"].includes(intent)) {
      return "Authors can save drafts and submit them for review, but cannot advance editorial workflow.";
    }
    if (existing?.createdBy !== undefined && existing.createdBy !== editorId) {
      return "Authors can only edit stories they created.";
    }
    if (existing && !authorEditableStatuses.includes(existing.status)) {
      return "This story has moved beyond the author editing stage.";
    }
    return null;
  }

  if (!existing) {
    return "Fact checkers cannot create stories.";
  }
  if (!factCheckerEditableStatuses.includes(existing.status)) {
    return "Fact checkers can only edit stories in the review queue.";
  }
  if (!["save", "review", "fact-check"].includes(intent)) {
    return "Fact checkers cannot approve, schedule, publish, or archive stories.";
  }
  return null;
}
