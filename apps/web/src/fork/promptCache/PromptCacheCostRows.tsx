import {
  formatPromptCacheUsd,
  promptCacheCosts,
  type PromptCacheCostRow,
  type PromptCachePrices,
} from "@t3tools/client-runtime/state/prompt-cache";
import { formatTokens } from "@t3tools/shared/usageFormat";

function CostRow(props: {
  readonly label: string;
  readonly detail: string;
  readonly row: PromptCacheCostRow;
  readonly note?: string | null;
}) {
  const cost = formatPromptCacheUsd(props.row.costUsd);
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <div className="text-foreground text-sm">{props.label}</div>
        <div className="text-muted-foreground text-xs">
          {props.detail}
          {props.note ? ` · ${props.note}` : null}
        </div>
      </div>
      {cost === null ? null : (
        <span className="shrink-0 text-foreground text-sm tabular-nums">{cost}</span>
      )}
    </div>
  );
}

/** What the next message costs after the cache went cold, for each way to continue. */
export function PromptCacheCostRows(props: {
  readonly tokens: number;
  readonly prices: PromptCachePrices | null;
}) {
  const { continueCold, compactFirst, newThread } = promptCacheCosts(props);
  const saving = formatPromptCacheUsd(compactFirst.savingPerMessageUsd);
  return (
    <div className="flex flex-col gap-2">
      <CostRow
        label="Continue cold"
        detail={`Writes ${formatTokens(continueCold.tokens)} to the cache again`}
        row={continueCold}
      />
      <CostRow
        label="Compact first"
        detail={`≈ ${formatTokens(compactFirst.tokens)} once to compact, then ≈ ${formatTokens(compactFirst.contextAfterTokens)} of context`}
        row={compactFirst}
        note={saving === null ? null : `then ${saving} less per message`}
      />
      <CostRow
        label="Start a new thread"
        detail={`Starts from ≈ ${formatTokens(newThread.contextAfterTokens)}`}
        row={newThread}
      />
      {props.prices === null ? (
        <p className="text-muted-foreground text-xs">
          Add this model's prices on the Usage page to see costs.
        </p>
      ) : null}
    </div>
  );
}
