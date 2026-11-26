import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { create } from "zustand";

import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import {
  createRecentSwitcherMachine,
  IDLE_RECENT_SWITCHER_STATE,
  type RecentSwitcherCommitReason,
  type RecentSwitcherMachine,
  type RecentSwitcherState,
} from "./recentSwitcherMachine";
import {
  browserStorage,
  expireRecentThreads,
  parseRecentDraftKey,
  readListCollapsed,
  readTimeoutMinutes,
  recentDraftKey,
  reconcileRecentThreadEntries,
  recordRecentThreadVisit,
  resolveRecentThreadList,
  writeListCollapsed,
  writeTimeoutMinutes,
  type RecentThreadCandidate,
  type RecentThreadEntry,
} from "./recentThreadsMru";

interface RecentThreadsStoreState {
  /** Published only while the switcher is open; React shows nothing for the other phases. */
  readonly switcher: RecentSwitcherState;
  /** The modifier the user holds, for the "release Ctrl" hints. */
  readonly holdKeyLabel: string;
}

let listCollapsed = readListCollapsed(browserStorage());

/** Small on purpose: rows and the sidebar subscribe through the narrow selectors below. */
export const useRecentThreadsStore = create<RecentThreadsStoreState>(() => ({
  switcher: { ...IDLE_RECENT_SWITCHER_STATE, listCollapsed },
  holdKeyLabel: "Ctrl",
}));

// Read only when Ctrl+Tab is pressed, so they stay out of the store rows subscribe to.
let recentEntries: readonly RecentThreadEntry[] = [];
let routeThreadKey: string | null = null;
let timeoutMinutes = readTimeoutMinutes(browserStorage());

function resolveRecentKey(
  key: string,
  drafts: ReturnType<typeof useComposerDraftStore.getState>,
  hydrated: boolean,
): string | null {
  const draftId = parseRecentDraftKey(key);
  if (draftId === null) {
    // A thread still promoting from a draft keeps the draft's entry until it finalizes.
    const ref = parseScopedThreadKey(key);
    if (ref === null) return key;
    for (const [id, draft] of Object.entries(drafts.draftThreadsByThreadKey)) {
      if (draft.promotedTo && scopedThreadKey(draft.promotedTo) === key) {
        return recentDraftKey(id as DraftId);
      }
    }
    return key;
  }
  // `promotedTo` alone is provisional: a failed send can restore the draft.
  if (Object.hasOwn(drafts.promotedDraftRedirects, draftId)) {
    return scopedThreadKey(drafts.promotedDraftRedirects[draftId]!);
  }
  return !hydrated || Object.hasOwn(drafts.draftThreadsByThreadKey, draftId) ? key : null;
}

export function subscribeRecentDrafts(): () => void {
  const sync = () => {
    const drafts = useComposerDraftStore.getState();
    const hydrated = useComposerDraftStore.persist.hasHydrated();
    const resolveKey = (key: string) => resolveRecentKey(key, drafts, hydrated);
    recentEntries = reconcileRecentThreadEntries(recentEntries, resolveKey);
    if (routeThreadKey !== null) routeThreadKey = resolveKey(routeThreadKey);
    const { items } = recentSwitcher.getState();
    const nextItems = items.map(resolveKey);
    if (nextItems.some((key, index) => key !== items[index])) {
      // Re-key promoted drafts in place; a discarded or duplicated entry closes the picker.
      if (nextItems.every((key) => key !== null) && new Set(nextItems).size === nextItems.length) {
        recentSwitcher.replaceItems(nextItems);
      } else {
        recentSwitcher.cancel();
      }
    }
  };
  const unsubscribe = useComposerDraftStore.subscribe((drafts, previous) => {
    if (
      drafts.draftThreadsByThreadKey !== previous.draftThreadsByThreadKey ||
      drafts.promotedDraftRedirects !== previous.promotedDraftRedirects
    )
      sync();
  });
  const unsubscribeHydration = useComposerDraftStore.persist.onFinishHydration(sync);
  sync();
  return () => {
    unsubscribe();
    unsubscribeHydration();
  };
}

export function getRecentThreadsTimeoutMinutes(): number {
  return timeoutMinutes;
}

type RecentThreadLookup = (key: string) => RecentThreadCandidate | null;

function expire(lookup: RecentThreadLookup, now: number): void {
  // Off a thread route, the list's head is the thread just left; it counts as open.
  const anchorKey = routeThreadKey ?? recentEntries[0]?.key ?? null;
  recentEntries = expireRecentThreads(
    recentEntries,
    anchorKey,
    now,
    timeoutMinutes * 60_000,
    lookup,
  );
}

export function setRecentThreadsTimeoutMinutes(
  minutes: number,
  lookup: RecentThreadLookup,
  now = Date.now(),
): void {
  // Threads already past the old timeout stay gone under a longer one.
  expire(lookup, now);
  timeoutMinutes = minutes;
  writeTimeoutMinutes(browserStorage(), minutes);
}

/** Called with every thread the route opens, and null when it leaves threads. */
export function recordRouteThread(
  key: string | null,
  lookup: RecentThreadLookup,
  now = Date.now(),
): void {
  const nextKey =
    key === null
      ? null
      : resolveRecentKey(
          key,
          useComposerDraftStore.getState(),
          useComposerDraftStore.persist.hasHydrated(),
        );
  if (nextKey === routeThreadKey) return;
  recentEntries = recordRecentThreadVisit(recentEntries, routeThreadKey, nextKey, now);
  routeThreadKey = nextKey;
  expire(lookup, now);
}

export function resolveRecentThreads(
  lookup: RecentThreadLookup,
  now = Date.now(),
): { readonly items: readonly string[]; readonly currentKey: string | null } {
  expire(lookup, now);
  return {
    items: resolveRecentThreadList(recentEntries, routeThreadKey, lookup),
    currentKey: routeThreadKey,
  };
}

export function setRecentSwitcherHoldKeyLabel(label: string): void {
  if (useRecentThreadsStore.getState().holdKeyLabel !== label) {
    useRecentThreadsStore.setState({ holdKeyLabel: label });
  }
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
  readListCollapsed: () => listCollapsed,
  writeListCollapsed: (collapsed) => {
    listCollapsed = collapsed;
    writeListCollapsed(browserStorage(), collapsed);
  },
  onChange: (switcher) => {
    // A quick tap goes idle -> pending -> idle without UI; skip waking subscribers for it.
    if (switcher.phase !== "open" && useRecentThreadsStore.getState().switcher.phase !== "open") {
      return;
    }
    useRecentThreadsStore.setState({ switcher });
  },
  onCommit: (key, reason) => commitHandler(key, reason),
});

export function useRecentSwitcherOpen(): boolean {
  return useRecentThreadsStore((state) => state.switcher.phase === "open");
}

export function selectRecentSwitcherSelectedKey(state: RecentThreadsStoreState): string | null {
  const { switcher } = state;
  return switcher.phase === "open" ? (switcher.items[switcher.selected] ?? null) : null;
}

export interface RecentThreadRowState {
  readonly selected: boolean;
  readonly number: number;
}

let itemIndex: { items: readonly string[]; index: Map<string, number> } | null = null;

function indexOfItem(items: readonly string[], key: string): number {
  if (itemIndex?.items !== items) {
    itemIndex = { items, index: new Map(items.map((item, index) => [item, index])) };
  }
  return itemIndex.index.get(key) ?? -1;
}

/** The row's 1-based number, negated when selected; null when it is not listed. */
function encodeRowState(state: RecentThreadsStoreState, threadKey: string): number | null {
  const { switcher } = state;
  if (switcher.phase !== "open") return null;
  const index = indexOfItem(switcher.items, threadKey);
  if (index === -1) return null;
  return index === switcher.selected ? -(index + 1) : index + 1;
}

/**
 * A sidebar row's part in an open switcher. Unlisted rows always get null and
 * are dimmed by CSS, so opening and closing re-renders only the listed rows.
 */
export function useRecentThreadRowState(threadKey: string): RecentThreadRowState | null {
  const encoded = useRecentThreadsStore((state) => encodeRowState(state, threadKey));
  if (encoded === null) return null;
  return { selected: encoded < 0, number: Math.abs(encoded) };
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

function isThread(ref: ScopedThreadRef, thread: Pick<RevealThread, "environmentId" | "id">) {
  return thread.id === ref.threadId && thread.environmentId === ref.environmentId;
}

export function isHiddenInSidebar<TGroup extends RevealFolderGroup>(
  key: string,
  input: RecentSwitcherRevealInput<TGroup>,
): boolean {
  const ref = parseScopedThreadKey(key);
  if (ref === null) return false;
  const inShelf = input.shelves.some(
    (shelf) =>
      shelf.threads.some((thread) => isThread(ref, thread)) &&
      !shelf.shown.some((thread) => isThread(ref, thread)),
  );
  if (inShelf || input.folders === null) return inShelf;
  const { folders } = input;
  const thread = folders.threads.find((candidate) => isThread(ref, candidate));
  if (thread === undefined) return false;
  const group = folders.groups.find((candidate) =>
    candidate.memberProjectRefs.some(
      (member) =>
        member.environmentId === thread.environmentId && member.projectId === thread.projectId,
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

/** `shown` plus the revealed thread from `all`, in `all`'s order. `shown` holds items of `all`. */
export function withRecentSwitcherReveal<T extends RevealThread>(
  shown: readonly T[],
  all: readonly T[],
  revealKey: string | null,
): readonly T[] {
  if (revealKey === null) return shown;
  const ref = parseScopedThreadKey(revealKey);
  if (ref === null || shown.some((thread) => isThread(ref, thread))) return shown;
  const revealed = all.find((thread) => isThread(ref, thread));
  if (revealed === undefined) return shown;
  if (shown.length === 0) return [revealed];
  const shownSet = new Set(shown);
  return all.filter((thread) => thread === revealed || shownSet.has(thread));
}
