import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2ProviderTurnTokenUsage,
  UsageModelPriceOverride,
} from "@t3tools/contracts";
import { formatTokens, formatUsd } from "@t3tools/shared/usageFormat";

const MINUTE_MS = 60_000;

/**
 * Prompt cache lifetimes of models run through OpenCode, counted from the start of the last
 * request. Measured on GitHub Copilot: Claude caches expire after 5 minutes, as on Anthropic's
 * API; GPT caches stayed warm for 25 minutes.
 */
const OPENCODE_PROMPT_CACHE_TTLS: ReadonlyArray<{
  readonly model: RegExp;
  readonly ttlMs: number;
}> = [
  { model: /^(?:github-copilot|anthropic)\/claude-/i, ttlMs: 5 * MINUTE_MS },
  { model: /^github-copilot\/gpt-/i, ttlMs: 25 * MINUTE_MS },
];

/**
 * An OpenCode model entry, "Claude Opus 5.5 (planner, 150K)", that OpenCode keeps warm with
 * keep-alive requests T3 Code doesn't see. Matched after the provider prefix; warm for this long
 * after the last reply.
 */
const OPENCODE_KEEP_WARM_MODEL = { id: "claude-opus-5.5-planner", warmMs: 20 * MINUTE_MS };

/** OpenCode stamps usage when a turn ends, so the cache clock started up to this much earlier. */
const TURN_END_STAMP_MARGIN_MS = MINUTE_MS;

/** Context size from which a cold send is worth a warning and compacting first is offered. */
const WARNING_MIN_TOKENS = 100_000;

/** Assumed size of a compaction summary. */
export const COMPACTION_SUMMARY_TOKENS = 15_000;
/** Assumed context of a new thread before its first message: system prompt, tools and rules. */
export const FRESH_THREAD_BASE_TOKENS = 25_000;
/** Assumed model calls per user message, each re-reading the context from the cache. */
export const MODEL_CALLS_PER_MESSAGE = 4.5;

export interface PromptCacheUsage {
  readonly usedTokens: number;
  readonly updatedAt: string;
  readonly promptCacheTtlMs?: number | undefined;
  readonly promptCacheExpiresAt?: string | undefined;
}

export type PromptCacheState =
  | { readonly kind: "warm"; readonly msLeft: number; readonly expiresAtMs: number }
  | {
      readonly kind: "cold";
      readonly msSince: number;
      readonly tokens: number;
      readonly expiresAtMs: number;
    };

/** Whether this provider's prompt cache lifetime can be known at all; see the table above. */
export function hasPromptCacheLifetime(driver: string | null | undefined): boolean {
  return driver === "opencode" || driver === "claudeAgent";
}

type UsageTurns = ReadonlyArray<
  Pick<
    OrchestrationV2ProviderTurn,
    "providerThreadId" | "ordinal" | "status" | "tokenUsage" | "turnTokenUsage" | "model"
  >
>;

interface UsageSampleTurn {
  readonly usage: OrchestrationV2ProviderTurnTokenUsage;
  readonly model: string | null;
  /** A later completed turn on the same provider thread reported no usage, such as a compaction. */
  readonly superseded: boolean;
}

// A projection change replaces its turns array, so each array is scanned once per usage sample.
const usageSampleTurns = new WeakMap<UsageTurns, UsageSampleTurn>();

function usageSampleTurn(turns: UsageTurns, usage: OrchestrationV2ProviderTurnTokenUsage) {
  const cached = usageSampleTurns.get(turns);
  if (cached?.usage === usage) return cached;
  const turn = turns.find((candidate) => candidate.tokenUsage === usage);
  const sample = {
    usage,
    model: turn?.model ?? turn?.turnTokenUsage?.models?.at(-1) ?? null,
    superseded:
      turn !== undefined &&
      turns.some(
        (later) =>
          later.providerThreadId === turn.providerThreadId &&
          later.ordinal > turn.ordinal &&
          later.status === "completed" &&
          later.tokenUsage === undefined,
      ),
  };
  usageSampleTurns.set(turns, sample);
  return sample;
}

/** The model that produced a usage sample, as its provider turn recorded it. */
export function promptCacheUsageModel(
  turns: UsageTurns,
  usage: OrchestrationV2ProviderTurnTokenUsage | null,
): string | null {
  return usage === null ? null : usageSampleTurn(turns, usage).model;
}

/**
 * The model whose cache the next send can reuse: the one that produced the usage, or null when the
 * thread now sends to another model, whose cache starts empty, or when a later completed turn
 * reported no usage, so the usage no longer describes the context.
 */
export function promptCacheModel(input: {
  readonly turns: UsageTurns;
  readonly usage: OrchestrationV2ProviderTurnTokenUsage | null;
  readonly sendModel: string | null | undefined;
}): string | null {
  if (input.usage === null) return null;
  const { model, superseded } = usageSampleTurn(input.turns, input.usage);
  if (superseded) return null;
  return input.sendModel == null || input.sendModel === model ? model : null;
}

/**
 * When the provider's prompt cache for the last request expires, in epoch ms, or null when the
 * provider and model have no known cache lifetime. Claude Code reports its own; OpenCode's comes
 * from the table above, for the model that produced the usage.
 */
function promptCacheExpiresAtMs(input: {
  readonly driver: string | null | undefined;
  readonly model: string | null | undefined;
  readonly usage: Pick<PromptCacheUsage, "updatedAt" | "promptCacheTtlMs" | "promptCacheExpiresAt">;
}): number | null {
  const updatedAt = Date.parse(input.usage.updatedAt);
  if (input.driver === "claudeAgent") {
    const expiresAt = Date.parse(input.usage.promptCacheExpiresAt ?? "");
    if (Number.isFinite(expiresAt)) return expiresAt;
    const ttlMs = input.usage.promptCacheTtlMs;
    return ttlMs === undefined || !Number.isFinite(updatedAt) ? null : updatedAt + ttlMs;
  }
  if (input.driver === "opencode" && Number.isFinite(updatedAt)) {
    const model = input.model ?? "";
    if (model.slice(model.indexOf("/") + 1) === OPENCODE_KEEP_WARM_MODEL.id) {
      return updatedAt + OPENCODE_KEEP_WARM_MODEL.warmMs;
    }
    const ttlMs = OPENCODE_PROMPT_CACHE_TTLS.find((entry) => entry.model.test(model))?.ttlMs;
    return ttlMs === undefined ? null : updatedAt + ttlMs - TURN_END_STAMP_MARGIN_MS;
  }
  return null;
}

/**
 * Null while a turn runs (the cache is in use), before the first turn, and when the lifetime is
 * unknown. `model` is the one the next send reuses the cache of; see promptCacheModel.
 */
export function promptCacheState(input: {
  readonly driver: string | null | undefined;
  readonly model: string | null | undefined;
  readonly usage: PromptCacheUsage | null;
  readonly running: boolean;
  readonly nowMs: number;
}): PromptCacheState | null {
  if (input.running || input.usage === null) return null;
  const expiresAtMs = promptCacheExpiresAtMs({ ...input, usage: input.usage });
  if (expiresAtMs === null) return null;
  return input.nowMs < expiresAtMs
    ? { kind: "warm", msLeft: expiresAtMs - input.nowMs, expiresAtMs }
    : {
        kind: "cold",
        msSince: input.nowMs - expiresAtMs,
        tokens: input.usage.usedTokens,
        expiresAtMs,
      };
}

/** Whether a cold send is costly enough to warn about and to offer compacting first. */
export function isWorthWarning(input: {
  readonly tokens: number;
  readonly coldCostUsd: number | null;
}): boolean {
  return input.tokens >= WARNING_MIN_TOKENS;
}

/**
 * The resume-compaction gate for providers whose cache lifetime comes from this file, or null to
 * leave the decision to the existing Claude Code gate.
 */
export function promptCacheResumeCompaction(input: {
  readonly provider: string | null | undefined;
  readonly model?: string | null | undefined;
  readonly usedTokens: number | null | undefined;
  readonly updatedAt: string | null | undefined;
  readonly now: string;
}): boolean | null {
  if (input.provider !== "opencode") return null;
  const expiresAtMs = promptCacheExpiresAtMs({
    driver: input.provider,
    model: input.model,
    usage: { updatedAt: input.updatedAt ?? "" },
  });
  return (
    expiresAtMs !== null &&
    Date.parse(input.now) >= expiresAtMs &&
    isWorthWarning({ tokens: input.usedTokens ?? 0, coldCostUsd: null })
  );
}

function wholeMinutes(ms: number): number {
  return Math.floor(Math.max(0, ms) / MINUTE_MS);
}

export function formatPromptCacheMinutesLeft(msLeft: number): string {
  return msLeft < MINUTE_MS ? "< 1 min left" : `${wholeMinutes(msLeft)} min left`;
}

export function formatPromptCacheMinutesAgo(msSince: number): string {
  return msSince < MINUTE_MS ? "< 1 min" : `${wholeMinutes(msSince)} min`;
}

/** "Cache warm · 3 min left" or "Cache cold · 14 min · 412K". */
export function formatPromptCacheLabel(state: PromptCacheState): string {
  return state.kind === "warm"
    ? `Cache warm · ${formatPromptCacheMinutesLeft(state.msLeft)}`
    : `Cache cold · ${formatPromptCacheMinutesAgo(state.msSince)} · ${formatTokens(state.tokens)}`;
}

/** Share of the last request's input read from the cache, or null when the provider did not say. */
export function promptCacheHitShare(usage: {
  readonly inputTokens?: number | null | undefined;
  readonly cachedInputTokens?: number | null | undefined;
}): number | null {
  const { inputTokens, cachedInputTokens } = usage;
  if (inputTokens == null || cachedInputTokens == null || inputTokens <= 0) return null;
  return Math.min(1, cachedInputTokens / inputTokens);
}

export interface PromptCachePrices {
  readonly cacheReadPerToken: number;
  readonly cacheWritePerToken: number;
  readonly outputPerToken: number;
}

/**
 * The model's prices from the Usage page's price overrides, matched as the Usage page does: by the
 * model name the provider records (OpenCode's without its provider prefix), after model aliases,
 * against trimmed override names. Pass the model that produced the usage, not the selected one.
 * Missing cache prices fall back to the input price, as there.
 */
export function promptCachePrices(input: {
  readonly driver: string | null | undefined;
  readonly model: string | null | undefined;
  readonly overrides: Readonly<Record<string, UsageModelPriceOverride>>;
  readonly aliases: Readonly<Record<string, string>>;
}): PromptCachePrices | null {
  const model = input.model?.trim() ?? "";
  const recorded = input.driver === "opencode" ? model.slice(model.indexOf("/") + 1) : model;
  const key = resolveModelAlias(recorded, input.aliases).trim();
  const override = Object.entries(input.overrides).find(([name]) => name.trim() === key)?.[1];
  if (override === undefined) return null;
  const perToken = (perMillion: number) => perMillion / 1_000_000;
  return {
    cacheReadPerToken: perToken(
      override.cacheReadCostPerMillionTokens ?? override.inputCostPerMillionTokens,
    ),
    cacheWritePerToken: perToken(
      override.cacheWriteCostPerMillionTokens ?? override.inputCostPerMillionTokens,
    ),
    outputPerToken: perToken(override.outputCostPerMillionTokens),
  };
}

// An alias chain that loops prices the model under its own name, as the Usage page does.
function resolveModelAlias(model: string, aliases: Readonly<Record<string, string>>): string {
  const seen = new Set<string>();
  let target = model;
  while (Object.hasOwn(aliases, target)) {
    if (seen.has(target)) return model;
    seen.add(target);
    target = aliases[target]!;
  }
  return target;
}

export interface PromptCacheCostRow {
  /** Tokens billed now at cache-write or output prices. */
  readonly tokens: number;
  /** The context each later message re-reads. */
  readonly contextAfterTokens: number;
  /** Null without prices; never zero. */
  readonly costUsd: number | null;
}

export interface PromptCacheCosts {
  readonly continueCold: PromptCacheCostRow;
  readonly compactFirst: PromptCacheCostRow & {
    readonly savingPerMessageUsd: number | null;
  };
  readonly newThread: PromptCacheCostRow;
}

function priced(cost: number): number | null {
  return Number.isFinite(cost) && cost > 0 ? cost : null;
}

/**
 * Approximate cost of the next message in a thread whose cache is cold: sending as is re-writes
 * the whole context to the cache; compacting first re-reads it once for the summary, writes the
 * summary, then writes the smaller context; a new thread writes only its base context.
 */
export function promptCacheCosts(input: {
  readonly tokens: number;
  readonly prices: PromptCachePrices | null;
}): PromptCacheCosts {
  const { tokens, prices } = input;
  const compactedTokens = FRESH_THREAD_BASE_TOKENS + COMPACTION_SUMMARY_TOKENS;
  const cost = (compute: (prices: PromptCachePrices) => number) =>
    prices === null ? null : priced(compute(prices));
  return {
    continueCold: {
      tokens,
      contextAfterTokens: tokens,
      costUsd: cost((p) => tokens * p.cacheWritePerToken),
    },
    compactFirst: {
      tokens: tokens + COMPACTION_SUMMARY_TOKENS + compactedTokens,
      contextAfterTokens: compactedTokens,
      costUsd: cost(
        (p) =>
          tokens * p.cacheWritePerToken +
          COMPACTION_SUMMARY_TOKENS * p.outputPerToken +
          compactedTokens * p.cacheWritePerToken,
      ),
      savingPerMessageUsd: cost(
        (p) =>
          Math.max(0, tokens - compactedTokens) * p.cacheReadPerToken * MODEL_CALLS_PER_MESSAGE,
      ),
    },
    newThread: {
      tokens: FRESH_THREAD_BASE_TOKENS,
      contextAfterTokens: FRESH_THREAD_BASE_TOKENS,
      costUsd: cost((p) => FRESH_THREAD_BASE_TOKENS * p.cacheWritePerToken),
    },
  };
}

/** "≈ $2.06", "< $0.01", or null without a price. */
export function formatPromptCacheUsd(costUsd: number | null): string | null {
  if (costUsd === null) return null;
  return costUsd < 0.01 ? "< $0.01" : `≈ ${formatUsd(costUsd)}`;
}
