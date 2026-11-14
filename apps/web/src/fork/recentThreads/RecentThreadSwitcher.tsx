import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { KeybindingShortcut } from "@t3tools/contracts";
import { useParams, useRouter, type AnyRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { useSidebarVisibility } from "../../components/ui/sidebar";
import { effectiveShortcutsForCommand } from "../../keybindings";
import { isMacPlatform } from "../../lib/utils";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { registerCommands, registerMenuAction } from "../../shortcuts/dispatcher";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { buildThreadRouteParams, resolveThreadRouteTarget } from "../../threadRoutes";
import { RecentThreadsChip } from "./RecentThreadsChip";
import { lookupThread } from "./recentThreadLookup";
import { RecentThreadPanelRow } from "./RecentThreadsList";
import {
  recentSwitcher,
  recordRouteThread,
  resolveRecentThreads,
  selectRecentSwitcherSelectedKey,
  setRecentSwitcherCommitHandler,
  setRecentSwitcherHoldKeyLabel,
  useRecentSwitcherOpen,
  useRecentThreadsStore,
} from "./recentThreadsStore";

interface HeldModifiers {
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
}

const NO_MODIFIERS: HeldModifiers = { ctrl: false, meta: false, alt: false };

function routeThreadKeyOfParams(params: Parameters<typeof resolveThreadRouteTarget>[0]) {
  const target = resolveThreadRouteTarget(params);
  return target?.kind === "server" ? scopedThreadKey(target.threadRef) : null;
}

function readRouteThreadKey(router: AnyRouter): string | null {
  return routeThreadKeyOfParams(router.state.matches.at(-1)?.params ?? {});
}

function heldModifiersOfShortcut(shortcut: KeybindingShortcut | undefined): HeldModifiers {
  if (shortcut === undefined) return { ctrl: true, meta: false, alt: false };
  const mac = isMacPlatform(navigator.platform);
  return {
    ctrl: shortcut.ctrlKey || (shortcut.modKey && !mac),
    meta: shortcut.metaKey || (shortcut.modKey && mac),
    alt: shortcut.altKey,
  };
}

function holdKeyLabel(held: HeldModifiers): string {
  const mac = isMacPlatform(navigator.platform);
  if (held.ctrl) return "Ctrl";
  if (held.meta) return mac ? "Cmd" : "Meta";
  return mac ? "Option" : "Alt";
}

function stillHeld(
  held: HeldModifiers,
  event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "altKey">,
): boolean {
  return (held.ctrl && event.ctrlKey) || (held.meta && event.metaKey) || (held.alt && event.altKey);
}

function consume(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

function closestData(target: EventTarget | null, attribute: string): HTMLElement | null {
  return target instanceof Element ? (target.closest<HTMLElement>(`[${attribute}]`) ?? null) : null;
}

/**
 * Wires keys, pointer and focus events to the switcher. Window capture
 * listeners run before the composer, the terminal and anything else focused.
 */
function installRecentThreadSwitcherInput(router: AnyRouter): () => void {
  let held: HeldModifiers = NO_MODIFIERS;
  // Set after a pointer commit or toggle, until the click and context menu that follow have passed.
  let swallowPointerSequence = false;

  const press = (direction: 1 | -1, modifiers: HeldModifiers) => {
    if (recentSwitcher.getState().phase === "idle") {
      if (isCommandPaletteOpen()) return false;
      held = modifiers;
      const { items, currentKey } = resolveRecentThreads(lookupThread);
      setRecentSwitcherHoldKeyLabel(holdKeyLabel(modifiers));
      const canHold = modifiers.ctrl || modifiers.meta || modifiers.alt;
      if (!recentSwitcher.press({ direction, items, currentKey, canHold })) return false;
      // A focused frame keeps the modifier's key up to itself; take focus back so the release is heard.
      const active = document.activeElement;
      if (
        recentSwitcher.getState().phase !== "idle" &&
        active instanceof HTMLElement &&
        (active.tagName === "IFRAME" || active.tagName === "WEBVIEW")
      ) {
        active.blur();
      }
      return true;
    }
    recentSwitcher.press({ direction, items: [], currentKey: null, canHold: true });
    return true;
  };

  const shortcutModifiers = (command: "thread.recent.next" | "thread.recent.previous") =>
    heldModifiersOfShortcut(
      effectiveShortcutsForCommand(appAtomRegistry.get(primaryServerKeybindingsAtom), command, {
        context: { previewFocus: true, previewOpen: true },
      })[0],
    );

  const onSwitcherKeyDown = (event: KeyboardEvent) => {
    if (recentSwitcher.getState().phase === "idle" || event.isComposing) return false;
    switch (event.key) {
      case "Control":
      case "Meta":
      case "Alt":
      case "Shift":
        return false;
      case "Escape":
        consume(event);
        recentSwitcher.cancel();
        return true;
      case "ArrowDown":
      case "ArrowRight":
        consume(event);
        recentSwitcher.move(1);
        return true;
      case "ArrowUp":
      case "ArrowLeft":
        consume(event);
        recentSwitcher.move(-1);
        return true;
      case "Enter":
        consume(event);
        recentSwitcher.release();
        return true;
    }
    if (!stillHeld(held, event)) {
      // The modifier's key up was missed (focus moved away mid-switch): treat this as the release.
      recentSwitcher.release();
      return false;
    }
    if (event.code === "KeyL" && !event.shiftKey) {
      consume(event);
      if (!event.repeat) recentSwitcher.toggleList();
      return true;
    }
    return false;
  };

  // The chord is consumed even with nothing to switch to, so it never reaches the focused widget.
  const handleCommand = (direction: 1 | -1) => (event: KeyboardEvent) => {
    if (event.isComposing) return false;
    consume(event);
    press(direction, { ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey });
    return true;
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (recentSwitcher.getState().phase === "idle") return;
    if (!stillHeld(held, event)) recentSwitcher.release();
  };

  const onPointerDown = (event: PointerEvent) => {
    swallowPointerSequence = false;
    if (recentSwitcher.getState().phase === "idle") return;
    const toggle = closestData(event.target, "data-recent-switch-toggle");
    if (toggle !== null) {
      consume(event);
      swallowPointerSequence = true;
      recentSwitcher.toggleList();
      return;
    }
    // Sidebar rows include shelf and folder headers; only thread rows commit.
    const commitTarget =
      closestData(event.target, "data-recent-switch-commit")?.dataset.recentSwitchCommit ??
      closestData(event.target, "data-sidebar-row")?.dataset.sidebarRow;
    if (commitTarget !== undefined && event.button === 0 && lookupThread(commitTarget) !== null) {
      consume(event);
      swallowPointerSequence = true;
      recentSwitcher.commitKey(commitTarget);
      return;
    }
    if (closestData(event.target, "data-recent-switch-surface") !== null) {
      consume(event);
      swallowPointerSequence = true;
      return;
    }
    if (stillHeld(held, event)) recentSwitcher.cancel();
    else recentSwitcher.release();
  };

  const onPointerUp = () => {
    if (!swallowPointerSequence) return;
    window.setTimeout(() => {
      swallowPointerSequence = false;
    }, 0);
  };

  const onClickLike = (event: MouseEvent) => {
    if (swallowPointerSequence || recentSwitcher.getState().phase !== "idle") consume(event);
  };

  const onBlur = () => recentSwitcher.cancel();
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") recentSwitcher.cancel();
  };

  // Keeps the target row in sight, including one a closed shelf just revealed.
  const unsubscribeScroll = useRecentThreadsStore.subscribe((state, previous) => {
    const key = selectRecentSwitcherSelectedKey(state);
    if (key === null || key === selectRecentSwitcherSelectedKey(previous)) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-sidebar-row="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  });

  const disposers = [
    setRecentSwitcherCommitHandler((key) => {
      const ref = parseScopedThreadKey(key);
      if (ref === null || key === readRouteThreadKey(router)) return;
      // Recorded now, not when the route settles, so a quick second tap already sees the switch.
      recordRouteThread(key, lookupThread);
      void router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(ref),
      });
    }),
    registerCommands(
      {
        "thread.recent.next": handleCommand(1),
        "thread.recent.previous": handleCommand(-1),
      },
      {
        capture: true,
        when: (event) => closestData(event.target, "data-keybinding-capture") === null,
        onKeyDown: onSwitcherKeyDown,
      },
    ),
    // A focused desktop browser forwards the chord; desktop then focuses the app so the release reaches it.
    registerMenuAction("thread.recent.next", () => {
      press(1, shortcutModifiers("thread.recent.next"));
    }),
    registerMenuAction("thread.recent.previous", () => {
      press(-1, shortcutModifiers("thread.recent.previous"));
    }),
    unsubscribeScroll,
  ];
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("click", onClickLike, true);
  window.addEventListener("auxclick", onClickLike, true);
  window.addEventListener("contextmenu", onClickLike, true);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    for (const dispose of disposers) dispose();
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("click", onClickLike, true);
    window.removeEventListener("auxclick", onClickLike, true);
    window.removeEventListener("contextmenu", onClickLike, true);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    recentSwitcher.cancel();
  };
}

/**
 * Stands in for the collapsed sidebar. Expanded, it is just the chip and its
 * popover; folded (Ctrl+L), a slim panel with the chip and the list slides in.
 */
function RecentThreadsPanel() {
  const listCollapsed = useRecentThreadsStore((state) => state.switcher.listCollapsed);
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/45" />
      {listCollapsed ? (
        <RecentThreadsSlimPanel />
      ) : (
        <div
          data-recent-switch-surface=""
          className="fixed top-12 left-2 z-50 w-71 rounded-lg bg-sidebar shadow-2xl"
        >
          <RecentThreadsChip />
        </div>
      )}
    </>
  );
}

function RecentThreadsSlimPanel() {
  const items = useRecentThreadsStore((state) => state.switcher.items);
  const selected = useRecentThreadsStore((state) => state.switcher.selected);
  return (
    <aside
      aria-label="Recent threads"
      data-recent-switch-surface=""
      data-testid="recent-threads-panel"
      className="fixed inset-y-0 left-0 z-50 flex w-75 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-[opacity,translate] duration-150 ease-out [-webkit-app-region:no-drag] starting:-translate-x-6 starting:opacity-0 motion-reduce:transition-none"
    >
      <div className="flex h-12 shrink-0 items-center pr-4 pl-13 text-sm font-medium text-muted-foreground">
        Recent threads
      </div>
      <RecentThreadsChip className="mx-2 mb-2 shrink-0" />
      <ul
        role="listbox"
        aria-label="Recent threads"
        className="min-h-0 space-y-0.5 overflow-y-auto px-2 pb-2"
      >
        {items.map((key, index) => (
          <RecentThreadPanelRow
            key={key}
            threadKey={key}
            index={index}
            selected={index === selected}
          />
        ))}
      </ul>
    </aside>
  );
}

/** Dims every sidebar thread row but the selection, without re-rendering the rows. */
function RecentThreadsSidebarDim() {
  const selectedKey = useRecentThreadsStore(selectRecentSwitcherSelectedKey);
  const keep = selectedKey === null ? "" : `:not([data-sidebar-row="${CSS.escape(selectedKey)}"])`;
  return <style>{`[data-thread-item] [data-sidebar-row]${keep}{opacity:.4}`}</style>;
}

/**
 * The Ctrl+Tab recent thread switcher: records every thread the route opens
 * and owns the switcher's input. Mounted once, inside the sidebar provider.
 */
export function RecentThreadSwitcher() {
  const router = useRouter();
  const routeThreadKey = useParams({ strict: false, select: routeThreadKeyOfParams });
  const open = useRecentSwitcherOpen();
  const sidebarVisible = useSidebarVisibility();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- records each route change in the in-memory recent list, which lives outside React
  useEffect(() => {
    recordRouteThread(routeThreadKey, lookupThread);
  }, [routeThreadKey]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- pages such as /pair unmount the sidebar layout; leaving for them leaves the thread
  useEffect(() => () => recordRouteThread(null, lookupThread), []);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes window key, pointer and focus listeners and the desktop menu actions for the switcher
  useEffect(() => installRecentThreadSwitcherInput(router), [router]);

  if (!open) return null;
  return sidebarVisible ? <RecentThreadsSidebarDim /> : <RecentThreadsPanel />;
}
