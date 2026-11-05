import { parseScopedThreadKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  AlarmClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotDashedIcon,
  MessageCircleQuestionIcon,
  ShieldQuestionIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { memo, useLayoutEffect, useRef } from "react";

import { cn } from "~/lib/utils";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useProject, useThreadShell } from "../../state/entities";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import type { SidebarThreadSummary } from "../../types";
import { useUiStateStore } from "../../uiStateStore";
import { ProjectFavicon } from "../../components/ProjectFavicon";
import {
  hasUnseenCompletion,
  resolveSidebarThreadStatus,
  resolveThreadLastVisitedAt,
} from "../../components/Sidebar.logic";
import { RecentThreadNumberBadge } from "./RecentThreadRowBadge";

// The statuses sidebar rows show, with the same icons and colors.
const STATUS_ICONS: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  working: { icon: CircleDashedIcon, label: "Working", className: "text-info-foreground" },
  waiting: { icon: CircleDotDashedIcon, label: "Waiting", className: "text-muted-foreground" },
  approval: { icon: ShieldQuestionIcon, label: "Approval", className: "text-warning-foreground" },
  input: {
    icon: MessageCircleQuestionIcon,
    label: "Input",
    className: "text-indigo-600 dark:text-indigo-300",
  },
  request: { icon: UserRoundIcon, label: "Request", className: "text-guest-foreground" },
  limited: { icon: CircleAlertIcon, label: "Limited", className: "text-warning-foreground" },
  failed: { icon: CircleAlertIcon, label: "Failed", className: "text-error-foreground" },
  woke: { icon: AlarmClockIcon, label: "Woke", className: "text-warning-foreground" },
  done: { icon: CircleCheckIcon, label: "Done", className: "text-success-foreground" },
};

function compactTimeLabel(label: string): string {
  if (label === "just now") return "now";
  return label.endsWith(" ago") ? label.slice(0, -4) : label;
}

function RelativeTime(props: { timestamp: string }) {
  const nowMinute = useNowMinute();
  return (
    <span className="text-xs tabular-nums text-secondary-label">
      {compactTimeLabel(
        formatRelativeTimeLabel(props.timestamp, Date.parse(`${nowMinute}:00.000Z`)),
      )}
    </span>
  );
}

function useThreadStatusKey(thread: SidebarThreadSummary | null, threadKey: string): string | null {
  const localLastVisitedAt = useUiStateStore((state) => state.threadLastVisitedAtById[threadKey]);
  if (thread === null) return null;
  const status = resolveSidebarThreadStatus(thread);
  if (status !== "ready") return status;
  const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localLastVisitedAt);
  return hasUnseenCompletion({ ...thread, lastVisitedAt }) ? "done" : null;
}

function StatusOrTime(props: { thread: SidebarThreadSummary; threadKey: string }) {
  const statusKey = useThreadStatusKey(props.thread, props.threadKey);
  const status = statusKey === null ? undefined : STATUS_ICONS[statusKey];
  if (status === undefined) {
    return <RelativeTime timestamp={props.thread.latestUserMessageAt ?? props.thread.updatedAt} />;
  }
  const Icon = status.icon;
  return <Icon role="img" aria-label={status.label} className={cn("size-3.5", status.className)} />;
}

function useRecentThread(threadKey: string) {
  const ref = parseScopedThreadKey(threadKey);
  const thread = useThreadShell(ref);
  const project = useProject(
    thread === null ? null : scopeProjectRef(thread.environmentId, thread.projectId),
  );
  return { thread, project };
}

/** Keeps the selected row of a scrolling list in view as the selection moves. */
function useScrollIntoViewWhenSelected(selected: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- scrolls the newly selected row into view after the selection moves
  useLayoutEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return ref;
}

/** One line in the header popover: number, project icon, title, project, status or time. */
export const RecentThreadListRow = memo(function RecentThreadListRow(props: {
  threadKey: string;
  index: number;
  selected: boolean;
}) {
  const { thread, project } = useRecentThread(props.threadKey);
  const ref = useScrollIntoViewWhenSelected(props.selected);
  if (thread === null) return null;
  return (
    <li
      ref={ref}
      role="option"
      aria-selected={props.selected}
      data-recent-switch-commit={props.threadKey}
      className={cn(
        "flex h-7.5 cursor-pointer items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap",
        props.selected
          ? "bg-foreground/[0.09] text-foreground"
          : "text-foreground/90 hover:bg-foreground/[0.05]",
      )}
    >
      <RecentThreadNumberBadge number={props.index + 1} selected={props.selected} />
      {project ? <ProjectFavicon project={project} className="size-4 shrink-0" /> : null}
      <span className="min-w-0 flex-[0_1_auto] truncate">{thread.title}</span>
      {project ? (
        <span className="min-w-12 max-w-[34%] flex-[0_1_auto] truncate text-xs text-muted-foreground/70">
          {project.title}
        </span>
      ) : null}
      <span className="ml-auto inline-flex shrink-0 items-center pl-3">
        <StatusOrTime thread={thread} threadKey={props.threadKey} />
      </span>
    </li>
  );
});

/** A two-line row in the slide-in panel shown while the sidebar is collapsed. */
export const RecentThreadPanelRow = memo(function RecentThreadPanelRow(props: {
  threadKey: string;
  index: number;
  selected: boolean;
}) {
  const { thread, project } = useRecentThread(props.threadKey);
  const ref = useScrollIntoViewWhenSelected(props.selected);
  if (thread === null) return null;
  return (
    <li
      ref={ref}
      role="option"
      aria-selected={props.selected}
      data-recent-switch-commit={props.threadKey}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5",
        props.selected
          ? "bg-primary/20 text-sidebar-foreground ring-1 ring-inset ring-primary/70"
          : "opacity-50 hover:opacity-80",
      )}
    >
      <RecentThreadNumberBadge number={props.index + 1} selected={props.selected} />
      {project ? <ProjectFavicon project={project} className="size-4 shrink-0" /> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{thread.title}</span>
        {project ? (
          <span className="truncate text-xs text-secondary-label">{project.title}</span>
        ) : null}
      </span>
      <span className="inline-flex shrink-0 items-center">
        <StatusOrTime thread={thread} threadKey={props.threadKey} />
      </span>
    </li>
  );
});

/** The title shown in the folded chip. */
export function useRecentThreadTitle(threadKey: string | null): string {
  const thread = useThreadShell(threadKey === null ? null : parseScopedThreadKey(threadKey));
  return thread?.title ?? "";
}
