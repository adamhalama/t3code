import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Minimize2Icon } from "lucide-react";

import type { CommandPaletteActionItem } from "../../components/CommandPalette.logic";
import { ITEM_ICON_CLASS } from "../../components/CommandPalette.logic";
import { useThreadCompaction } from "./promptCacheStore";

/** "Compact thread" for the open thread, through the same compaction as the composer's. */
export function useCompactThreadPaletteItem(
  threadRef: ScopedThreadRef | null,
): CommandPaletteActionItem | null {
  const compaction = useThreadCompaction(threadRef === null ? null : scopedThreadKey(threadRef));
  if (compaction === null) return null;
  return {
    kind: "action",
    value: "action:compact-thread",
    searchTerms: ["compact", "compaction", "context", "summarize", "cache", "tokens"],
    title: "Compact thread",
    icon: <Minimize2Icon className={ITEM_ICON_CLASS} />,
    disabled: compaction.disabled,
    run: async () => compaction.compact(),
  };
}
