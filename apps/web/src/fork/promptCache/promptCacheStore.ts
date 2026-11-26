import { useEffect, useSyncExternalStore } from "react";
import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useStableCallback } from "../../hooks/useStableCallback";

export interface ThreadCompaction {
  readonly compact: () => void;
  readonly disabled: boolean;
}

// Compaction runs in the thread view, which owns the composer's send context; the header badge,
// the composer chip and the command palette reach it through this registry.
const compactionsByThreadKey = new Map<string, ThreadCompaction>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function useThreadCompaction(threadKey: string | null): ThreadCompaction | null {
  const read = () => (threadKey === null ? null : (compactionsByThreadKey.get(threadKey) ?? null));
  return useSyncExternalStore(subscribe, read, read);
}

export function useProvideThreadCompaction(
  threadKey: string,
  compact: () => void,
  disabled: boolean,
): void {
  const stableCompact = useStableCallback(compact);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes this view's compaction to the header and command palette, which live outside it
  useEffect(() => {
    const entry = { compact: stableCompact, disabled };
    compactionsByThreadKey.set(threadKey, entry);
    notify();
    return () => {
      if (compactionsByThreadKey.get(threadKey) !== entry) return;
      compactionsByThreadKey.delete(threadKey);
      notify();
    };
  }, [threadKey, stableCompact, disabled]);
}

const ASK_BEFORE_COLD_SEND_STORAGE_KEY = "t3code:fork:prompt-cache:ask-before-cold-send:v1";

/** Whether sending to a thread whose cache has expired asks first; off after "Don't ask again". */
export function useAskBeforeColdSend(): [boolean, (ask: boolean) => void] {
  return useLocalStorage(ASK_BEFORE_COLD_SEND_STORAGE_KEY, true, Schema.Boolean);
}
