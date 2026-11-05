import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { create } from "zustand";

import {
  createRecentSwitcherMachine,
  IDLE_RECENT_SWITCHER_STATE,
  type RecentSwitcherCommitReason,
  type RecentSwitcherMachine,
  type RecentSwitcherState,
} from "./recentSwitcherMachine";
import {
  browserStorage,
  pruneRecentThreads,
  readListCollapsed,
  readRecentThreadKeys,
  touchRecentThread,
  writeListCollapsed,
  writeRecentThreadKeys,
  type RecentThreadCandidate,
} from "./recentThreadsMru";

interface RecentThreadsStoreState {
  readonly recentKeys: readonly string[];
  readonly switcher: RecentSwitcherState;
  /** The modifier the user holds, for the "release Ctrl" hints. */
  readonly holdKeyLabel: string;
}

/** Small on purpose: rows and the sidebar subscribe through the narrow selectors below. */
export const useRecentThreadsStore = create<RecentThreadsStoreState>(() => ({
  recentKeys: readRecentThreadKeys(browserStorage()),
  switcher: { ...IDLE_RECENT_SWITCHER_STATE, listCollapsed: readListCollapsed(browserStorage()) },
  holdKeyLabel: "Ctrl",
}));

export function touchRecentThreadKey(key: string): void {
  const { recentKeys } = useRecentThreadsStore.getState();
  const next = touchRecentThread(recentKeys, key);
  if (next === recentKeys) return;
  useRecentThreadsStore.setState({ recentKeys: next });
  writeRecentThreadKeys(browserStorage(), next);
}

export function pruneRecentThreadKeys(lookup: (key: string) => RecentThreadCandidate | null): void {
  const { recentKeys } = useRecentThreadsStore.getState();
  const next = pruneRecentThreads(recentKeys, lookup);
  if (next === recentKeys) return;
  useRecentThreadsStore.setState({ recentKeys: next });
  writeRecentThreadKeys(browserStorage(), next);
}

type CommitHandler = (key: string, reason: RecentSwitcherCommitReason) => void;
let commitHandler: CommitHandler = () => undefined;

/** The switcher component owns navigation; it plugs in here while mounted. */
export function setRecentSwitcherCommitHandler(handler: CommitHandler): () => void {
  commitHandler = handler;
  return () => {
    if (commitHandler === handler) commitHandler = () => undefined;
  };
}

export const recentSwitcher: RecentSwitcherMachine = createRecentSwitcherMachine({
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  readListCollapsed: () => readListCollapsed(browserStorage()),
  writeListCollapsed: (collapsed) => writeListCollapsed(browserStorage(), collapsed),
  onChange: (switcher) => useRecentThreadsStore.setState({ switcher }),
  onCommit: (key, reason) => {
    touchRecentThreadKey(key);
    commitHandler(key, reason);
  },
});

export function useRecentSwitcherOpen(): boolean {
  return useRecentThreadsStore((state) => state.switcher.phase === "open");
}

export function selectRecentSwitcherSelectedKey(state: RecentThreadsStoreState): string | null {
  const { switcher } = state;
  return switcher.phase === "open" ? (switcher.items[switcher.selected] ?? null) : null;
}

export type RecentThreadRowState =
  | { readonly kind: "dim" }
  | { readonly kind: "listed" | "selected"; readonly number: number };

function encodeRowState(state: RecentThreadsStoreState, threadKey: string): string | null {
  const { switcher } = state;
  if (switcher.phase !== "open") return null;
  const index = switcher.items.indexOf(threadKey);
  if (index === -1) return "dim";
  return `${index === switcher.selected ? "selected" : "listed"}:${index + 1}`;
}

/**
 * A sidebar row's part in an open switcher. The selector returns a string, so
 * a key press re-renders only the rows whose highlight or number changed.
 */
export function useRecentThreadRowState(threadKey: string): RecentThreadRowState | null {
  const encoded = useRecentThreadsStore((state) => encodeRowState(state, threadKey));
  if (encoded === null) return null;
  if (encoded === "dim") return { kind: "dim" };
  const [kind, number] = encoded.split(":");
  return { kind: kind === "selected" ? "selected" : "listed", number: Number(number) };
}

interface RevealThread {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly projectId: string;
}

interface RevealFolderGroup {
  readonly memberProjectRefs: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly projectId: string;
  }>;
}

export interface RecentSwitcherRevealInput<TGroup extends RevealFolderGroup> {
  /** Each shelf that can hide threads, with the threads it shows right now. */
  readonly shelves: ReadonlyArray<{
    readonly threads: readonly RevealThread[];
    readonly shown: readonly RevealThread[];
  }>;
  /** Project folders in the boring sidebar; null when the sidebar has none. */
  readonly folders: {
    readonly groups: readonly TGroup[];
    readonly threads: readonly RevealThread[];
    readonly isCollapsed: (group: TGroup) => boolean;
  } | null;
}

function revealThreadKey(thread: Pick<RevealThread, "environmentId" | "id">): string {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

export function isHiddenInSidebar<TGroup extends RevealFolderGroup>(
  key: string,
  input: RecentSwitcherRevealInput<TGroup>,
): boolean {
  const inShelf = input.shelves.some(
    (shelf) =>
      shelf.threads.some((thread) => revealThreadKey(thread) === key) &&
      !shelf.shown.some((thread) => revealThreadKey(thread) === key),
  );
  if (inShelf || input.folders === null) return inShelf;
  const { folders } = input;
  const thread = folders.threads.find((candidate) => revealThreadKey(candidate) === key);
  if (thread === undefined) return false;
  const group = folders.groups.find((candidate) =>
    candidate.memberProjectRefs.some(
      (ref) => ref.environmentId === thread.environmentId && ref.projectId === thread.projectId,
    ),
  );
  return group !== undefined && folders.isCollapsed(group);
}

/**
 * The switcher's selection when a closed shelf or folder hides it, else null.
 * Moving the selection between visible rows keeps returning null, so the
 * sidebar re-renders only when a hidden thread has to be shown or put back.
 * Nothing is written to the shelves' or folders' saved open state.
 */
export function useRecentSwitcherRevealKey<TGroup extends RevealFolderGroup>(
  input: RecentSwitcherRevealInput<TGroup>,
): string | null {
  return useRecentThreadsStore((state) => {
    const key = selectRecentSwitcherSelectedKey(state);
    return key !== null && isHiddenInSidebar(key, input) ? key : null;
  });
}

/** `shown` plus the revealed thread from `all`, in `all`'s order. */
export function withRecentSwitcherReveal<T extends RevealThread>(
  shown: readonly T[],
  all: readonly T[],
  revealKey: string | null,
): readonly T[] {
  if (revealKey === null || shown.some((thread) => revealThreadKey(thread) === revealKey)) {
    return shown;
  }
  if (!all.some((thread) => revealThreadKey(thread) === revealKey)) return shown;
  const shownKeys = new Set(shown.map(revealThreadKey));
  return all.filter((thread) => {
    const key = revealThreadKey(thread);
    return key === revealKey || shownKeys.has(key);
  });
}
