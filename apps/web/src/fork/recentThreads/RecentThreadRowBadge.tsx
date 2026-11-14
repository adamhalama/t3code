import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import type { RecentThreadRowState } from "./recentThreadsStore";

/** Recent-order number, shown in a row's time slot while the switcher is open. */
export function RecentThreadNumberBadge(props: { number: number; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 font-medium font-sans text-xs tabular-nums",
        props.selected
          ? "bg-primary text-primary-foreground"
          : "bg-foreground/[0.07] text-muted-foreground",
      )}
    >
      {props.number}
    </span>
  );
}

/**
 * Takes the place of a sidebar row's time label. `data-jump-hint` keeps it
 * visible in the slot that hides everything else for jump hints.
 */
export function RecentThreadRowBadge(props: {
  state: RecentThreadRowState;
  statusIcon?: ReactNode;
}) {
  return (
    <span data-jump-hint className="inline-flex items-center gap-1.5">
      {props.statusIcon}
      <RecentThreadNumberBadge number={props.state.number} selected={props.state.selected} />
    </span>
  );
}

/** Merged last into the selected row's surface; `RecentThreadSwitcher` dims the others with CSS. */
export function recentThreadRowClassName(state: RecentThreadRowState | null): string | false {
  if (state === null || !state.selected) return false;
  return "bg-primary/20 text-sidebar-foreground opacity-100 ring-1 ring-inset ring-primary/70 hover:bg-primary/25 before:pointer-events-none before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-r-sm before:bg-primary";
}
