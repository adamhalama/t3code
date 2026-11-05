import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  isHiddenInSidebar,
  recentSwitcher,
  useRecentThreadsStore,
  withRecentSwitcherReveal,
} from "./recentThreadsStore";

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
