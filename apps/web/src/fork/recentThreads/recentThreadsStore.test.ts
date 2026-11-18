import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { recentDraftKey } from "./recentThreadsMru";
import {
  isHiddenInSidebar,
  recentSwitcher,
  useRecentThreadsStore,
  withRecentSwitcherReveal,
} from "./recentThreadsStore";

/** The recent list is module state; each test gets its own copy. */
async function freshStore() {
  vi.resetModules();
  return import("./recentThreadsStore");
}

const minute = 60_000;
const lookup = () => ({ archivedAt: null, deletedAt: null });

const env = EnvironmentId.make("env");
const thread = (id: string, projectId = "p1") => ({
  environmentId: env,
  id: ThreadId.make(id),
  projectId,
});

const a = thread("a");
const b = thread("b");
const c = thread("c");
const folder = (projectId: string) => ({ memberProjectRefs: [{ environmentId: env, projectId }] });

describe("withRecentSwitcherReveal", () => {
  it("returns the shown list untouched without a reveal", () => {
    const shown = [a];
    expect(withRecentSwitcherReveal(shown, [a, b, c], null)).toBe(shown);
    expect(withRecentSwitcherReveal(shown, [a, b, c], "env:a")).toBe(shown);
  });

  it("adds the revealed thread in the group's order", () => {
    expect(withRecentSwitcherReveal([c], [a, b, c], "env:b")).toEqual([b, c]);
    expect(withRecentSwitcherReveal([], [a, b, c], "env:a")).toEqual([a]);
  });

  it("ignores a reveal for a thread of another group", () => {
    const shown = [a];
    expect(withRecentSwitcherReveal(shown, [a, b], "env:z")).toBe(shown);
  });
});

describe("isHiddenInSidebar", () => {
  it("finds threads in closed shelves", () => {
    const input = {
      shelves: [
        { threads: [a, b], shown: [a] },
        { threads: [c], shown: [c] },
      ],
      folders: null,
    };
    expect(isHiddenInSidebar("env:b", input)).toBe(true);
    expect(isHiddenInSidebar("env:a", input)).toBe(false);
    expect(isHiddenInSidebar("env:c", input)).toBe(false);
  });

  it("finds threads in collapsed project folders", () => {
    const open = folder("p1");
    const closed = folder("p2");
    const inClosed = thread("d", "p2");
    const input = {
      shelves: [],
      folders: {
        groups: [open, closed],
        threads: [a, inClosed],
        isCollapsed: (group: typeof open) => group === closed,
      },
    };
    expect(isHiddenInSidebar("env:d", input)).toBe(true);
    expect(isHiddenInSidebar("env:a", input)).toBe(false);
  });
});

describe("recent threads store", () => {
  it("keeps the active draft current through its automatic redirect", async () => {
    const { recentSwitcher, recordRouteThread, resolveRecentThreads, subscribeRecentDrafts } =
      await freshStore();
    const { DraftId, useComposerDraftStore } = await import("../../composerDraftStore");
    const drafts = useComposerDraftStore.getState();
    const draftId = DraftId.make("unsent");
    const draftKey = recentDraftKey(draftId);
    drafts.setProjectDraftThreadId(
      { environmentId: env, projectId: ProjectId.make("p1") },
      draftId,
      {
        threadId: b.id,
      },
    );
    const unsubscribe = subscribeRecentDrafts();
    try {
      recordRouteThread("env:old", lookup, 0);
      recordRouteThread("env:a", lookup, minute);
      recordRouteThread(draftKey, lookup, 2 * minute);
      drafts.markDraftThreadPromoting(draftId);
      // The thread a promoting draft lands on is still that draft's entry.
      recordRouteThread("env:b", lookup, 3 * minute);
      expect(resolveRecentThreads(lookup, 3 * minute)).toEqual({
        items: [draftKey, "env:a", "env:old"],
        currentKey: draftKey,
      });
      recentSwitcher.press({
        direction: 1,
        items: [draftKey, "env:a", "env:old"],
        currentKey: draftKey,
        canHold: true,
      });
      drafts.finalizePromotedDraftThread(draftId);
      expect(recentSwitcher.getState()).toMatchObject({
        phase: "pending",
        items: ["env:b", "env:a", "env:old"],
        selected: 1,
      });
      recentSwitcher.cancel();
      expect(resolveRecentThreads(lookup, 4 * minute).currentKey).toBe("env:b");
      recordRouteThread("env:b", lookup, 5 * minute);
      expect(resolveRecentThreads(lookup, 5 * minute)).toEqual({
        items: ["env:b", "env:a", "env:old"],
        currentKey: "env:b",
      });
    } finally {
      unsubscribe();
    }
  });

  it("does not prune a missing draft until hydration finishes and removes discarded drafts", async () => {
    const { recordRouteThread, resolveRecentThreads, subscribeRecentDrafts } = await freshStore();
    const { DraftId, useComposerDraftStore } = await import("../../composerDraftStore");
    using hydrated = vi.spyOn(useComposerDraftStore.persist, "hasHydrated").mockReturnValue(false);
    const unsubscribe = subscribeRecentDrafts();
    try {
      const missingKey = recentDraftKey(DraftId.make("missing"));
      recordRouteThread(missingKey, lookup, 0);
      expect(resolveRecentThreads(lookup, minute).currentKey).toBe(missingKey);
      hydrated.mockReturnValue(true);
      await useComposerDraftStore.persist.rehydrate();
      expect(resolveRecentThreads(lookup, minute)).toEqual({ items: [], currentKey: null });

      const draftId = DraftId.make("discarded");
      const drafts = useComposerDraftStore.getState();
      drafts.setProjectDraftThreadId(
        { environmentId: env, projectId: ProjectId.make("p1") },
        draftId,
        {
          threadId: b.id,
        },
      );
      recordRouteThread(recentDraftKey(draftId), lookup, 2 * minute);
      recordRouteThread("env:a", lookup, 3 * minute);
      drafts.clearDraftThread(draftId);
      expect(resolveRecentThreads(lookup, 4 * minute).items).toEqual(["env:a"]);
    } finally {
      unsubscribe();
    }
  });

  it("dates a thread by when it was left and expires the rest after 30 minutes", async () => {
    const { recordRouteThread, resolveRecentThreads } = await freshStore();
    recordRouteThread("env:old", lookup, 0);
    recordRouteThread("env:a", lookup, minute);
    // Hours on A, then a short visit to settings, B and C.
    recordRouteThread(null, lookup, 180 * minute);
    recordRouteThread("env:b", lookup, 181 * minute);
    recordRouteThread("env:c", lookup, 185 * minute);
    expect(resolveRecentThreads(lookup, 200 * minute)).toEqual({
      items: ["env:c", "env:b", "env:a"],
      currentKey: "env:c",
    });
    // After a long break the thread before the open one still stays.
    expect(resolveRecentThreads(lookup, 600 * minute).items).toEqual(["env:c", "env:b"]);
  });

  it("keeps the thread you came from while you are away from threads", async () => {
    const { recordRouteThread, resolveRecentThreads } = await freshStore();
    recordRouteThread("env:a", lookup, 0);
    recordRouteThread("env:b", lookup, minute);
    recordRouteThread(null, lookup, 100 * minute);
    expect(resolveRecentThreads(lookup, 200 * minute).items).toEqual(["env:b", "env:a"]);
    recordRouteThread("env:b", lookup, 201 * minute);
    expect(resolveRecentThreads(lookup, 201 * minute).items).toEqual(["env:b", "env:a"]);
  });

  it("does not bring back threads that expired before the timeout was raised", async () => {
    const { recordRouteThread, resolveRecentThreads, setRecentThreadsTimeoutMinutes } =
      await freshStore();
    recordRouteThread("env:a", lookup, 0);
    recordRouteThread("env:b", lookup, minute);
    recordRouteThread("env:c", lookup, 2 * minute);
    setRecentThreadsTimeoutMinutes(0, lookup, 60 * minute);
    expect(resolveRecentThreads(lookup, 61 * minute).items).toEqual(["env:c", "env:b"]);
  });

  it("exposes the open switcher's selection to sidebar rows", () => {
    recentSwitcher.press({
      direction: 1,
      items: ["env:a", "env:b"],
      currentKey: "env:a",
      canHold: true,
    });
    recentSwitcher.move(1);
    const { switcher } = useRecentThreadsStore.getState();
    expect(switcher).toMatchObject({ phase: "open", selected: 0 });
    recentSwitcher.cancel();
    expect(useRecentThreadsStore.getState().switcher.phase).toBe("idle");
  });
});
