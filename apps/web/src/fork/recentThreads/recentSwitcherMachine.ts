/**
 * The Ctrl+Tab switcher's state machine, free of DOM and React; mirrors the mock's
 * `fixtures.js`. idle -> pending (pressed, modifier held, hold delay running; a
 * release now is a tap with no UI) -> open (visible; a release commits the selection).
 */

export const RECENT_SWITCHER_HOLD_DELAY_MS = 150;

export type RecentSwitcherPhase = "idle" | "pending" | "open";

export type RecentSwitcherCommitReason = "tap" | "release" | "click";

export interface RecentSwitcherState {
  readonly phase: RecentSwitcherPhase;
  /** Scoped thread keys in recent order; the open thread, when listed, is first. */
  readonly items: readonly string[];
  readonly selected: number;
  readonly listCollapsed: boolean;
}

export const IDLE_RECENT_SWITCHER_STATE: RecentSwitcherState = {
  phase: "idle",
  items: [],
  selected: 0,
  listCollapsed: false,
};

export interface RecentSwitcherMachineOptions {
  readonly holdDelayMs?: number;
  readonly setTimer: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly readListCollapsed: () => boolean;
  readonly writeListCollapsed: (collapsed: boolean) => void;
  readonly onChange: (state: RecentSwitcherState) => void;
  readonly onCommit: (key: string, reason: RecentSwitcherCommitReason) => void;
}

export interface RecentSwitcherPressInput {
  readonly direction: 1 | -1;
  readonly items: readonly string[];
  readonly currentKey: string | null;
  /** False when the shortcut has no modifier to hold, so every press is a tap. */
  readonly canHold: boolean;
}

export interface RecentSwitcherMachine {
  readonly getState: () => RecentSwitcherState;
  /** Returns false when there is nothing to switch to, so the key can be left alone. */
  readonly press: (input: RecentSwitcherPressInput) => boolean;
  readonly move: (direction: 1 | -1) => void;
  readonly release: () => void;
  readonly cancel: () => void;
  readonly commitKey: (key: string) => void;
  readonly toggleList: () => void;
  readonly dispose: () => void;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function createRecentSwitcherMachine(
  options: RecentSwitcherMachineOptions,
): RecentSwitcherMachine {
  const holdDelayMs = options.holdDelayMs ?? RECENT_SWITCHER_HOLD_DELAY_MS;
  let state = IDLE_RECENT_SWITCHER_STATE;
  let timer: unknown = null;

  const set = (next: RecentSwitcherState) => {
    state = next;
    options.onChange(state);
  };
  const stopTimer = () => {
    if (timer === null) return;
    options.clearTimer(timer);
    timer = null;
  };
  const reset = () => {
    stopTimer();
    set({ ...IDLE_RECENT_SWITCHER_STATE, listCollapsed: state.listCollapsed });
  };
  const commit = (key: string, reason: RecentSwitcherCommitReason) => {
    reset();
    options.onCommit(key, reason);
  };
  const select = (selected: number) => {
    stopTimer();
    set({ ...state, phase: "open", selected: wrapIndex(selected, state.items.length) });
  };

  return {
    getState: () => state,
    press: ({ direction, items, currentKey, canHold }) => {
      if (state.phase !== "idle") {
        select(state.selected + direction);
        return true;
      }
      const firstOther = items[0] === currentKey ? 1 : 0;
      if (items.length <= firstOther) return false;
      const selected = direction > 0 ? firstOther : items.length - 1;
      if (!canHold) {
        options.onCommit(items[selected]!, "tap");
        return true;
      }
      set({ phase: "pending", items, selected, listCollapsed: options.readListCollapsed() });
      timer = options.setTimer(() => {
        timer = null;
        if (state.phase === "pending") set({ ...state, phase: "open" });
      }, holdDelayMs);
      return true;
    },
    move: (direction) => {
      if (state.phase === "idle") return;
      select(state.selected + direction);
    },
    release: () => {
      if (state.phase === "idle") return;
      const key = state.items[state.selected];
      const reason = state.phase === "pending" ? "tap" : "release";
      if (key === undefined) reset();
      else commit(key, reason);
    },
    cancel: () => {
      if (state.phase === "idle") return;
      reset();
    },
    commitKey: (key) => {
      if (state.phase === "idle") return;
      commit(key, "click");
    },
    toggleList: () => {
      if (state.phase !== "open") return;
      const listCollapsed = !state.listCollapsed;
      options.writeListCollapsed(listCollapsed);
      set({ ...state, listCollapsed });
    },
    dispose: stopTimer,
  };
}
