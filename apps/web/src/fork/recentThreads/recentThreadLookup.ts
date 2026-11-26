import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";

import { useComposerDraftStore } from "../../composerDraftStore";
import { readThreadShell } from "../../state/entities";
import { parseRecentDraftKey } from "./recentThreadsMru";

const LIVE_DRAFT = { archivedAt: null, deletedAt: null };

export function lookupThread(key: string) {
  const draftId = parseRecentDraftKey(key);
  if (draftId !== null) {
    return Object.hasOwn(useComposerDraftStore.getState().draftThreadsByThreadKey, draftId)
      ? LIVE_DRAFT
      : null;
  }
  const ref = parseScopedThreadKey(key);
  return ref === null ? null : readThreadShell(ref);
}
