import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createRecentSwitcherMachine,
  RECENT_SWITCHER_HOLD_DELAY_MS,
  type RecentSwitcherCommitReason,
  type RecentSwitcherState,
} from "./recentSwitcherMachine";
import { touchRecentThread } from "./recentThreadsMru";

const ITEMS = ["env:current", "env:b", "env:c", "env:d"];

function setup(options: { listCollapsed?: boolean } = {}) {
  let savedListCollapsed = options.listCollapsed ?? false;
  const commits: Array<[string, RecentSwitcherCommitReason]> = [];
  const states: RecentSwitcherState[] = [];
  const machine = createRecentSwitcherMachine({
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    readListCollapsed: () => savedListCollapsed,
    writeListCollapsed: (collapsed) => {
      savedListCollapsed = collapsed;
    },
    onChange: (state) => states.push(state),
    onCommit: (key, reason) => commits.push([key, reason]),
  });
  const press = (direction: 1 | -1 = 1, items = ITEMS, canHold = true) =>
    machine.press({ direction, items, currentKey: "env:current", canHold });
  return {
    machine,
    press,
    commits,
    states,
    savedListCollapsed: () => savedListCollapsed,
  };
}

describe("recent switcher machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the previous thread on a tap without ever showing the switcher", () => {
    const { machine, press, commits, states } = setup();
    expect(press()).toBe(true);
    expect(machine.getState()).toMatchObject({ phase: "pending", selected: 1 });
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS - 1);
    machine.release();
    expect(commits).toEqual([["env:b", "tap"]]);
    expect(states.some((state) => state.phase === "open")).toBe(false);
    expect(machine.getState().phase).toBe("idle");
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().phase).toBe("idle");
  });

  it("opens the switcher on a hold with the second thread selected", () => {
    const { machine, press, commits } = setup();
    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState()).toMatchObject({ phase: "open", selected: 1, items: ITEMS });
    machine.release();
    expect(commits).toEqual([["env:b", "release"]]);
  });

  it("opens at once when Tab is pressed again before the hold delay", () => {
    const { machine, press } = setup();
    press();
    press();
    expect(machine.getState()).toMatchObject({ phase: "open", selected: 2 });
  });

  it("cycles with wrap in both directions", () => {
    const { machine, press, commits } = setup();
    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    press();
    press();
    expect(machine.getState().selected).toBe(3);
    press();
    expect(machine.getState().selected).toBe(0);
    press(-1);
    expect(machine.getState().selected).toBe(3);
    machine.move(1);
    machine.move(1);
    expect(machine.getState().selected).toBe(1);
    machine.release();
    expect(commits).toEqual([["env:b", "release"]]);
  });

  it("starts from the oldest thread for the previous direction", () => {
    const { machine, press } = setup();
    press(-1);
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().selected).toBe(3);
  });

  it("cancels on Escape or blur without committing", () => {
    const { machine, press, commits } = setup();
    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    machine.cancel();
    expect(machine.getState().phase).toBe("idle");
    machine.release();
    expect(commits).toEqual([]);

    press();
    machine.cancel();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().phase).toBe("idle");
    expect(commits).toEqual([]);
  });

  it("commits a clicked row", () => {
    const { machine, press, commits } = setup();
    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    machine.commitKey("env:d");
    expect(commits).toEqual([["env:d", "click"]]);
    expect(machine.getState().phase).toBe("idle");
  });

  it("toggles the list while open, remembers it, and never commits or closes", () => {
    const { machine, press, commits, savedListCollapsed } = setup();
    press();
    machine.toggleList();
    expect(machine.getState().listCollapsed).toBe(false);
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    machine.toggleList();
    expect(machine.getState()).toMatchObject({ phase: "open", listCollapsed: true });
    expect(savedListCollapsed()).toBe(true);
    expect(commits).toEqual([]);
    machine.release();

    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().listCollapsed).toBe(true);
    machine.toggleList();
    expect(savedListCollapsed()).toBe(false);
    expect(machine.getState()).toMatchObject({ phase: "open", listCollapsed: false });
  });

  it("reads the remembered list choice when a switch starts", () => {
    const { machine, press } = setup({ listCollapsed: true });
    press();
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().listCollapsed).toBe(true);
  });

  it("toggles between the two most recent threads on repeated taps", () => {
    let recent: readonly string[] = ["env:a", "env:b", "env:c"];
    let current = "env:a";
    const machine = createRecentSwitcherMachine({
      setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      readListCollapsed: () => false,
      writeListCollapsed: () => undefined,
      onChange: () => undefined,
      onCommit: (key) => {
        recent = touchRecentThread(recent, key);
        current = key;
      },
    });
    const tap = () => {
      machine.press({ direction: 1, items: recent, currentKey: current, canHold: true });
      machine.release();
    };
    tap();
    expect(current).toBe("env:b");
    tap();
    expect(current).toBe("env:a");
    tap();
    expect(current).toBe("env:b");
    expect(recent).toEqual(["env:b", "env:a", "env:c"]);
  });

  it("does nothing with a single thread", () => {
    const { machine, press, commits } = setup();
    expect(press(1, ["env:current"])).toBe(false);
    expect(press(1, [])).toBe(false);
    vi.advanceTimersByTime(RECENT_SWITCHER_HOLD_DELAY_MS);
    expect(machine.getState().phase).toBe("idle");
    expect(commits).toEqual([]);
  });

  it("selects the most recent thread when the open page is not a listed thread", () => {
    const { machine, commits } = setup();
    machine.press({ direction: 1, items: ["env:b", "env:c"], currentKey: null, canHold: true });
    expect(machine.getState().selected).toBe(0);
    machine.release();
    expect(commits).toEqual([["env:b", "tap"]]);
  });

  it("commits at once when the shortcut has no modifier to hold", () => {
    const { machine, press, commits } = setup();
    press(1, ITEMS, false);
    expect(commits).toEqual([["env:b", "tap"]]);
    expect(machine.getState().phase).toBe("idle");
  });
});
