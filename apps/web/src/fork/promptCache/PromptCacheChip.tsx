import { toServerClock } from "@t3tools/client-runtime/clock";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  formatPromptCacheLabel,
  formatPromptCacheMinutesAgo,
  formatPromptCacheMinutesLeft,
  isWorthWarning,
} from "@t3tools/client-runtime/state/prompt-cache";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { formatPercent } from "@t3tools/shared/usageFormat";
import { SnowflakeIcon, TimerIcon } from "lucide-react";
import { memo } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../../components/ui/popover";
import { Switch } from "../../components/ui/switch";
import { useClientSettings } from "../../hooks/useSettings";
import { formatShortTimestamp } from "../../timestampFormat";
import { PromptCacheCostRows } from "./PromptCacheCostRows";
import { useAskBeforeColdSend, useThreadCompaction } from "./promptCacheStore";
import { usePromptCacheView } from "./usePromptCacheView";

/**
 * The open thread's prompt cache: minutes left while warm, time since expiry and context size once
 * cold. Hidden while a turn runs and for providers whose cache lifetime is unknown.
 */
export const PromptCacheChip = memo(function PromptCacheChip(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly placement: "composer" | "header";
}) {
  const view = usePromptCacheView(scopeThreadRef(props.environmentId, props.threadId));
  const compaction = useThreadCompaction(view?.threadKey ?? null);
  const [askBeforeColdSend, setAskBeforeColdSend] = useAskBeforeColdSend();
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);
  if (view === null || view.state === null) return null;

  const { state } = view;
  const cold = state.kind === "cold";
  // A cold cache below the warning size reads in the same quiet style as a warm one.
  const warn = cold && isWorthWarning({ tokens: state.tokens, coldCostUsd: null });
  // The state is on the environment's clock; show the expiry on this device's.
  const expiresAt = formatShortTimestamp(
    new Date(state.expiresAtMs - toServerClock(props.environmentId, 0)).toISOString(),
    timestampFormat,
  );
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Badge
            variant={warn ? "error" : "secondary"}
            size={props.placement === "composer" ? "control" : "default"}
            render={<button type="button" aria-label={formatPromptCacheLabel(state)} />}
          />
        }
      >
        {cold ? <SnowflakeIcon aria-hidden="true" /> : <TimerIcon aria-hidden="true" />}
        <span className="tabular-nums">
          {cold ? formatPromptCacheLabel(state) : formatPromptCacheMinutesLeft(state.msLeft)}
        </span>
      </PopoverTrigger>
      <PopoverPopup width="md" side={props.placement === "composer" ? "top" : "bottom"}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <PopoverTitle>{cold ? "Prompt cache cold" : "Prompt cache warm"}</PopoverTitle>
            <p className="text-muted-foreground text-xs">
              {cold
                ? `Expired at ${expiresAt}, ${formatPromptCacheMinutesAgo(state.msSince)} ago.`
                : `Expires at ${expiresAt}, ${formatPromptCacheMinutesLeft(state.msLeft)}.`}
              {view.hitShare === null
                ? null
                : ` Last reply read ${formatPercent(view.hitShare, 0)} of its input from the cache.`}
            </p>
          </div>
          <PromptCacheCostRows tokens={view.tokens} prices={view.prices} />
          <div className="flex items-center justify-between gap-3">
            <Label>
              <Switch
                size="sm"
                checked={askBeforeColdSend}
                onCheckedChange={(checked) => setAskBeforeColdSend(checked)}
              />
              Ask before a cold send
            </Label>
            <Button
              size="sm"
              variant="outline"
              disabled={compaction === null || compaction.disabled}
              onClick={() => compaction?.compact()}
            >
              Compact now
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
});
