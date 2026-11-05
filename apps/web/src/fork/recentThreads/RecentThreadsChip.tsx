import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from "lucide-react";
import { useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { cn } from "~/lib/utils";
import { Kbd } from "../../components/ui/kbd";
import { useSidebarVisibility } from "../../components/ui/sidebar";
import { RecentThreadListRow, useRecentThreadTitle } from "./RecentThreadsList";
import {
  selectRecentSwitcherSelectedKey,
  useRecentSwitcherOpen,
  useRecentThreadsStore,
} from "./recentThreadsStore";

const POPOVER_GAP_PX = 18;
const POPOVER_MAX_WIDTH_PX = 460;
const POPOVER_EDGE_PX = 12;

function useHoldKeyLabel(): string {
  return useRecentThreadsStore((state) => state.holdKeyLabel);
}

function RecentThreadsFooter(props: { listCollapsed: boolean }) {
  const holdKey = useHoldKeyLabel();
  return (
    <div className="flex items-center gap-3 rounded-b-xl border-t border-foreground/[0.07] bg-foreground/[0.025] px-3.5 py-2 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        release <Kbd>{holdKey}</Kbd> open
      </span>
      <span className="flex-1" />
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1">
          <Kbd>{holdKey}</Kbd>
          <Kbd>L</Kbd>
        </span>
        {props.listCollapsed ? "expand" : "fold"}
      </span>
    </div>
  );
}

/** The list that flies out beside the chip, pointing at it. */
function RecentThreadsPopover(props: { anchor: HTMLElement }) {
  const items = useRecentThreadsStore((state) => state.switcher.items);
  const selected = useRecentThreadsStore((state) => state.switcher.selected);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const { anchor } = props;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the chip before paint so the popover opens already placed beside it
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setPosition({ top: rect.top + rect.height / 2 - 20, left: rect.right + POPOVER_GAP_PX });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);
  if (position === null) return null;
  const style: CSSProperties = {
    top: Math.max(POPOVER_EDGE_PX, position.top),
    left: position.left,
    width: `min(${POPOVER_MAX_WIDTH_PX}px, calc(100vw - ${position.left + 24}px))`,
    maxHeight: `calc(100dvh - ${Math.max(POPOVER_EDGE_PX, position.top) + 24}px)`,
  };
  return createPortal(
    <div
      role="dialog"
      aria-label="Recent threads"
      data-recent-switch-surface=""
      data-testid="recent-threads-popover"
      style={style}
      className="dialog-glass fixed z-50 flex flex-col rounded-xl border text-popover-foreground transition-[opacity,translate] duration-100 ease-out starting:-translate-x-2 starting:opacity-0 motion-reduce:transition-none"
    >
      <span
        aria-hidden
        className="absolute top-3.5 -left-1.5 size-2.75 rotate-45 border-b border-l border-foreground/10 bg-popover"
      />
      <ul
        role="listbox"
        aria-label="Recent threads"
        className="min-h-0 overflow-y-auto px-2 pt-1.5 pb-2 scroll-py-2"
      >
        {items.map((key, index) => (
          <RecentThreadListRow
            key={key}
            threadKey={key}
            index={index}
            selected={index === selected}
          />
        ))}
      </ul>
      <RecentThreadsFooter listCollapsed={false} />
    </div>,
    document.body,
  );
}

/**
 * Stands in for the sidebar's Search row while the switcher is open. It is
 * also the list toggle: expanded it anchors the popover, folded it carries the
 * selection. The controller toggles it on pointer down, so Ctrl+click works.
 */
export function RecentThreadsChip(props: { className?: string }) {
  const listCollapsed = useRecentThreadsStore((state) => state.switcher.listCollapsed);
  const selected = useRecentThreadsStore((state) => state.switcher.selected);
  const count = useRecentThreadsStore((state) => state.switcher.items.length);
  const selectedKey = useRecentThreadsStore(selectRecentSwitcherSelectedKey);
  const title = useRecentThreadTitle(listCollapsed ? selectedKey : null);
  // A callback ref, so the popover mounts once the chip it measures exists.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const position = `${selected + 1}/${count}`;
  return (
    <>
      <div
        ref={setAnchor}
        role="button"
        tabIndex={-1}
        aria-expanded={!listCollapsed}
        aria-label={listCollapsed ? "Show recent threads list" : "Hide recent threads list"}
        data-recent-switch-toggle=""
        data-testid="recent-threads-chip"
        className={cn(
          "flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium whitespace-nowrap select-none ring-1 ring-inset",
          listCollapsed
            ? "bg-primary/15 ring-primary/40 hover:bg-primary/20"
            : "bg-primary/25 ring-primary/70",
          props.className,
        )}
      >
        <HistoryIcon aria-hidden className="size-4 shrink-0 text-primary" />
        {listCollapsed ? (
          <>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{position}</span>
            <span aria-hidden className="shrink-0 text-muted-foreground">
              ·
            </span>
            <span className="min-w-0 flex-1 truncate">{title}</span>
          </>
        ) : (
          <>
            <span className="flex-1">Recent</span>
            <span className="text-xs text-muted-foreground tabular-nums">{position}</span>
          </>
        )}
        {listCollapsed ? (
          <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronLeftIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </div>
      {!listCollapsed && anchor !== null ? <RecentThreadsPopover anchor={anchor} /> : null}
    </>
  );
}

/** Covers the sidebar header's Search row while the switcher is open and the sidebar is shown. */
export function RecentThreadsHeaderChip() {
  const open = useRecentSwitcherOpen();
  const sidebarVisible = useSidebarVisibility();
  if (!open || !sidebarVisible) return null;
  return (
    <div className="absolute inset-0 z-10 rounded-lg bg-sidebar">
      <RecentThreadsChip className="size-full" />
    </div>
  );
}
