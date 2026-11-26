import { assistantCitationsToPlainText } from "@t3tools/shared/assistantCitations";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import type { ComposerThreadDraftState } from "../../composerDraftStore";

export function draftPreview(composer: ComposerThreadDraftState | null): string {
  if (composer === null) return "New thread";
  const prompt = assistantCitationsToPlainText(
    replaceComposerContextReferences(composer.prompt, (occurrence) => occurrence.label),
  )
    .trim()
    .split("\n", 1)[0];
  if (prompt) return prompt;
  // Hydrated images mirror the persisted list; count them only once.
  const count =
    Math.max(composer.images.length, composer.persistedAttachments.length) +
    composer.files.length +
    composer.terminalContexts.length +
    composer.previewAnnotations.length +
    composer.reviewComments.length;
  return count === 0 ? "New thread" : `${count} attachment${count === 1 ? "" : "s"}`;
}
