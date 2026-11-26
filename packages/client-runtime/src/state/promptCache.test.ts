import { ProviderThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  COMPACTION_SUMMARY_TOKENS,
  FRESH_THREAD_BASE_TOKENS,
  MODEL_CALLS_PER_MESSAGE,
  formatPromptCacheLabel,
  formatPromptCacheMinutesLeft,
  formatPromptCacheUsd,
  isWorthWarning,
  promptCacheCosts,
  promptCacheModel,
  promptCachePrices,
  promptCacheState,
} from "./promptCache.ts";

const MINUTE = 60_000;
const lastTurnAt = "2026-11-25T14:00:00.000Z";
const lastTurnMs = Date.parse(lastTurnAt);
const usage = { usedTokens: 412_000, updatedAt: lastTurnAt };

describe("promptCacheState", () => {
  it.each([
    {
      name: "OpenCode Copilot Claude just before the margin-adjusted 5 minutes",
      model: "github-copilot/claude-opus-5.5",
      after: 4 * MINUTE - 1,
      expected: { kind: "warm", msLeft: 1 },
    },
    {
      name: "OpenCode Copilot Claude at the margin-adjusted 5 minutes",
      model: "github-copilot/claude-opus-5.5",
      after: 4 * MINUTE,
      expected: { kind: "cold", msSince: 0, tokens: 412_000 },
    },
    {
      name: "OpenCode Copilot Claude seconds past the margin-adjusted 5 minutes",
      model: "github-copilot/claude-opus-5.5",
      after: 4 * MINUTE + 10_000,
      expected: { kind: "cold", msSince: 10_000, tokens: 412_000 },
    },
    {
      name: "OpenCode Copilot Claude after 5 minutes",
      model: "github-copilot/claude-opus-5.5",
      after: 5 * MINUTE,
      expected: { kind: "cold", msSince: MINUTE, tokens: 412_000 },
    },
    {
      name: "OpenCode planner 6 minutes after its last reply",
      model: "github-copilot/claude-opus-5.5-planner",
      after: 6 * MINUTE,
      expected: { kind: "warm", msLeft: 14 * MINUTE },
    },
    {
      name: "OpenCode planner 19 minutes after its last reply",
      model: "github-copilot/claude-opus-5.5-planner",
      after: 19 * MINUTE,
      expected: { kind: "warm", msLeft: MINUTE },
    },
    {
      name: "OpenCode planner 20 minutes after its last reply",
      model: "github-copilot/claude-opus-5.5-planner",
      after: 20 * MINUTE,
      expected: { kind: "cold", msSince: 0, tokens: 412_000 },
    },
    {
      name: "OpenCode Anthropic Claude after 10 minutes",
      model: "anthropic/claude-sonnet-5",
      after: 10 * MINUTE,
      expected: { kind: "cold", msSince: 6 * MINUTE, tokens: 412_000 },
    },
    {
      name: "OpenCode Copilot GPT within 25 minutes",
      model: "github-copilot/gpt-6.2-sol",
      after: 23 * MINUTE,
      expected: { kind: "warm", msLeft: MINUTE },
    },
    {
      name: "OpenCode Copilot GPT past 25 minutes",
      model: "github-copilot/gpt-6.2-sol",
      after: 24 * MINUTE,
      expected: { kind: "cold", msSince: 0, tokens: 412_000 },
    },
  ])("$name", ({ model, after, expected }) => {
    expect(
      promptCacheState({
        driver: "opencode",
        model,
        usage,
        running: false,
        nowMs: lastTurnMs + after,
      }),
    ).toMatchObject(expected);
  });

  it("uses Claude Code's reported lifetime without a margin", () => {
    const claudeUsage = { ...usage, promptCacheTtlMs: 5 * MINUTE };
    const state = (after: number) =>
      promptCacheState({
        driver: "claudeAgent",
        model: "claude-opus-4-6",
        usage: claudeUsage,
        running: false,
        nowMs: lastTurnMs + after,
      });
    expect(state(5 * MINUTE - 1)).toMatchObject({ kind: "warm", msLeft: 1 });
    expect(state(5 * MINUTE)).toMatchObject({ kind: "cold", msSince: 0 });
    expect(
      promptCacheState({
        driver: "claudeAgent",
        model: "claude-opus-4-6",
        usage: { ...claudeUsage, promptCacheExpiresAt: "2026-11-25T15:00:00.000Z" },
        running: false,
        nowMs: lastTurnMs + 10 * MINUTE,
      }),
    ).toMatchObject({ kind: "warm", msLeft: 50 * MINUTE });
  });

  it.each([
    { name: "while a turn runs", driver: "opencode", running: true, turn: usage },
    { name: "before the first turn", driver: "opencode", running: false, turn: null },
    {
      name: "for a provider without a known lifetime",
      driver: "codex",
      running: false,
      turn: usage,
    },
    {
      name: "for an OpenCode model without a known lifetime",
      driver: "opencode",
      model: "github-copilot/gemini-3-pro",
      running: false,
      turn: usage,
    },
    {
      name: "for Claude Code without a reported lifetime",
      driver: "claudeAgent",
      running: false,
      turn: usage,
    },
  ])("is unknown $name", ({ driver, model, running, turn }) => {
    expect(
      promptCacheState({
        driver,
        model: model ?? "github-copilot/claude-opus-5.5",
        usage: turn,
        running,
        nowMs: lastTurnMs + 30 * MINUTE,
      }),
    ).toBeNull();
  });
});

describe("promptCacheModel", () => {
  const sample = { ...usage };
  const reroutedSample = { ...usage };
  const providerThreadId = ProviderThreadId.make("provider-thread");
  const turns = [
    {
      providerThreadId,
      ordinal: 1,
      status: "completed",
      tokenUsage: reroutedSample,
      model: "github-copilot/gpt-6.2-sol",
    },
    {
      providerThreadId,
      ordinal: 2,
      status: "completed",
      tokenUsage: sample,
      turnTokenUsage: {
        usageScope: "main_agent",
        usageStatus: "complete",
        inputTokens: 1,
        outputTokens: 1,
        hasSubagents: false,
        models: ["github-copilot/claude-sonnet-5.5", "github-copilot/claude-opus-5.5"],
      },
    },
  ] as const;

  it.each([
    {
      name: "the last model the turn reported",
      usage: sample,
      sendModel: "github-copilot/claude-opus-5.5",
      expected: "github-copilot/claude-opus-5.5",
    },
    {
      name: "the turn's root model over its reported list",
      usage: reroutedSample,
      sendModel: null,
      expected: "github-copilot/gpt-6.2-sol",
    },
    {
      name: "unknown after a switch to another model",
      usage: sample,
      sendModel: "github-copilot/gpt-6.2-sol",
      expected: null,
    },
    {
      name: "unknown for usage no turn recorded",
      usage: { ...usage },
      sendModel: null,
      expected: null,
    },
    {
      name: "unknown after a later completed turn reported no usage, such as a compaction",
      usage: sample,
      sendModel: "github-copilot/claude-opus-5.5",
      later: { providerThreadId, ordinal: 3, status: "completed" },
      expected: null,
    },
  ] as const)("is $name", (row) => {
    const allTurns = "later" in row ? [...turns, row.later] : turns;
    expect(promptCacheModel({ turns: allTurns, usage: row.usage, sendModel: row.sendModel })).toBe(
      row.expected,
    );
  });
});

describe("formatPromptCacheLabel", () => {
  it.each([
    {
      state: { kind: "warm", msLeft: 59_999, expiresAtMs: 0 },
      expected: "Cache warm · < 1 min left",
    },
    {
      state: { kind: "warm", msLeft: MINUTE, expiresAtMs: 0 },
      expected: "Cache warm · 1 min left",
    },
    {
      state: { kind: "warm", msLeft: 3 * MINUTE + 59_999, expiresAtMs: 0 },
      expected: "Cache warm · 3 min left",
    },
    {
      state: { kind: "cold", msSince: 14 * MINUTE + 30_000, tokens: 412_300, expiresAtMs: 0 },
      expected: "Cache cold · 14 min · 412K",
    },
    {
      state: { kind: "cold", msSince: 0, tokens: 1_250_000, expiresAtMs: 0 },
      expected: "Cache cold · < 1 min · 1.25M",
    },
  ] as const)("$expected", ({ state, expected }) => {
    expect(formatPromptCacheLabel(state)).toBe(expected);
  });

  it("never shows a negative minute count", () => {
    expect(formatPromptCacheMinutesLeft(-5)).toBe("< 1 min left");
  });
});

describe("isWorthWarning", () => {
  it("warns from 100K tokens", () => {
    expect(isWorthWarning({ tokens: 99_999, coldCostUsd: 5 })).toBe(false);
    expect(isWorthWarning({ tokens: 100_000, coldCostUsd: null })).toBe(true);
  });
});

describe("promptCachePrices", () => {
  const overrides = {
    "claude-opus-5.5": {
      inputCostPerMillionTokens: 4,
      outputCostPerMillionTokens: 20,
      cacheReadCostPerMillionTokens: 0.2,
      cacheWriteCostPerMillionTokens: 5,
    },
    "gpt-6.2-sol": { inputCostPerMillionTokens: 2, outputCostPerMillionTokens: 10 },
  };

  it("matches OpenCode models by the name OpenCode records", () => {
    expect(
      promptCachePrices({
        driver: "opencode",
        model: "github-copilot/claude-opus-5.5",
        overrides,
        aliases: {},
      }),
    ).toEqual({
      cacheReadPerToken: 0.2 / 1e6,
      cacheWritePerToken: 5 / 1e6,
      outputPerToken: 20 / 1e6,
    });
  });

  it("follows model aliases and falls back to the input price for cache prices", () => {
    expect(
      promptCachePrices({
        driver: "opencode",
        model: "github-copilot/gpt-6.2-sol-long",
        overrides,
        aliases: { "gpt-6.2-sol-long": "gpt-6.2-sol" },
      }),
    ).toEqual({ cacheReadPerToken: 2e-6, cacheWritePerToken: 2e-6, outputPerToken: 10e-6 });
  });

  it("matches override names as the Usage page trims them", () => {
    expect(
      promptCachePrices({
        driver: "opencode",
        model: "github-copilot/gpt-6.2-sol",
        overrides: { " gpt-6.2-sol ": overrides["gpt-6.2-sol"] },
        aliases: {},
      }),
    ).toEqual({ cacheReadPerToken: 2e-6, cacheWritePerToken: 2e-6, outputPerToken: 10e-6 });
  });

  it.each([
    { name: "a model without an override", model: "github-copilot/claude-sonnet-5.5", aliases: {} },
    {
      name: "an alias cycle",
      model: "github-copilot/a",
      aliases: { a: "b", b: "a" },
    },
  ])("has no prices for $name", ({ model, aliases }) => {
    expect(promptCachePrices({ driver: "opencode", model, overrides, aliases })).toBeNull();
  });
});

describe("promptCacheCosts", () => {
  const prices = { cacheReadPerToken: 0.2e-6, cacheWritePerToken: 5e-6, outputPerToken: 20e-6 };
  const compacted = FRESH_THREAD_BASE_TOKENS + COMPACTION_SUMMARY_TOKENS;

  it("prices continuing cold, compacting first and starting over", () => {
    const costs = promptCacheCosts({ tokens: 500_000, prices });
    expect(costs.continueCold.costUsd).toBeCloseTo(2.5);
    expect(costs.compactFirst.costUsd).toBeCloseTo(
      2.5 + COMPACTION_SUMMARY_TOKENS * 20e-6 + compacted * 5e-6,
    );
    expect(costs.compactFirst.contextAfterTokens).toBe(compacted);
    expect(costs.compactFirst.savingPerMessageUsd).toBeCloseTo(
      (500_000 - compacted) * 0.2e-6 * MODEL_CALLS_PER_MESSAGE,
    );
    expect(costs.newThread.costUsd).toBeCloseTo(FRESH_THREAD_BASE_TOKENS * 5e-6);
  });

  it("keeps the token counts without prices", () => {
    const costs = promptCacheCosts({ tokens: 412_000, prices: null });
    expect(costs.continueCold).toEqual({
      tokens: 412_000,
      contextAfterTokens: 412_000,
      costUsd: null,
    });
    expect(costs.compactFirst.costUsd).toBeNull();
    expect(costs.compactFirst.savingPerMessageUsd).toBeNull();
    expect(costs.newThread.costUsd).toBeNull();
  });

  it("never prices at zero", () => {
    const free = { cacheReadPerToken: 0, cacheWritePerToken: 0, outputPerToken: 0 };
    const costs = promptCacheCosts({ tokens: 412_000, prices: free });
    expect(costs.continueCold.costUsd).toBeNull();
    expect(costs.compactFirst.savingPerMessageUsd).toBeNull();
    expect(formatPromptCacheUsd(costs.continueCold.costUsd)).toBeNull();
    expect(formatPromptCacheUsd(0.004)).toBe("< $0.01");
    expect(formatPromptCacheUsd(2.06)).toBe("≈ $2.06");
  });
});
