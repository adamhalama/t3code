import { useAtomValue } from "@effect/atom-react";
import { toServerClock } from "@t3tools/client-runtime/clock";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  deriveLatestContextWindowSnapshot,
  latestProviderTurnTokenUsage,
} from "@t3tools/client-runtime/state/context-window";
import {
  hasPromptCacheLifetime,
  promptCacheHitShare,
  promptCacheModel,
  promptCachePrices,
  promptCacheState,
  promptCacheUsageModel,
  type PromptCachePrices,
  type PromptCacheState,
} from "@t3tools/client-runtime/state/prompt-cache";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";

import { useComposerDraftStore } from "../../composerDraftStore";
import { useNowMinute } from "../../hooks/useNowMinute";
import { derivePhase } from "../../session-logic";
import {
  useQuietThreadProjection,
  useQuietThreadShell,
  useQuietThreadVisibleTurnItems,
} from "../../state/entities";
import { useEnvironmentProviders } from "../../state/environments";
import { serverEnvironment } from "../../state/server";

export interface PromptCacheView {
  readonly threadKey: string;
  /** Null while a turn runs or when the provider and model have no known cache lifetime. */
  readonly state: PromptCacheState | null;
  /** The state at a moment given in client epoch ms, such as a send. */
  readonly stateAt: (clientNowMs: number) => PromptCacheState | null;
  /** The context the next send re-reads. */
  readonly tokens: number;
  readonly hitShare: number | null;
  /** Prices of the model that produced the usage, or null without a price override. */
  readonly prices: PromptCachePrices | null;
}

const NO_PRICES = {};

// A projection change replaces the projection, so its turns are scanned once per change and
// shared by every chip and the cold-send dialog.
const usageSamples = new WeakMap<
  ThreadStructure,
  {
    readonly providerThread: ThreadStructure["providerThreads"][number] | undefined;
    readonly liveUsage: ReturnType<typeof latestProviderTurnTokenUsage>;
  }
>();

function usageSample(projection: ThreadStructure) {
  const cached = usageSamples.get(projection);
  if (cached !== undefined) return cached;
  const providerThread = projection.providerThreads.find(
    (thread) => thread.id === projection.thread.activeProviderThreadId,
  );
  const sample = {
    providerThread,
    liveUsage: latestProviderTurnTokenUsage(projection.providerTurns, projection, providerThread),
  };
  usageSamples.set(projection, sample);
  return sample;
}

/**
 * The open thread's prompt cache, from the same usage report as the context meter. Subscribes to
 * nothing past the thread shell for providers without a known cache lifetime, and re-renders at
 * most once a minute on its own.
 */
export function usePromptCacheView(threadRef: ScopedThreadRef | null): PromptCacheView | null {
  const shell = useQuietThreadShell(threadRef);
  const providersByEnvironment = useEnvironmentProviders();
  const driver =
    shell === null
      ? undefined
      : providersByEnvironment
          .get(shell.environmentId)
          ?.find((provider) => provider.instanceId === shell.modelSelection.instanceId)?.driver;
  const detailRef = hasPromptCacheLifetime(driver) ? threadRef : null;
  const structure = useQuietThreadProjection(detailRef);
  const visibleTurnItems = useQuietThreadVisibleTurnItems(detailRef);
  const settings = useAtomValue(
    serverEnvironment.settingsValueAtom(threadRef?.environmentId ?? ("" as EnvironmentId)),
  );
  // A model picked in the composer of a started thread applies at the next send.
  const draftSelection = useComposerDraftStore((store) => {
    const draft = threadRef === null ? null : store.getComposerDraft(threadRef);
    return draft?.modelSelectionExplicit === true && draft.activeProvider
      ? (draft.modelSelectionByProvider[draft.activeProvider] ?? null)
      : null;
  });
  const nowMinute = useNowMinute();
  if (threadRef === null || shell === null || structure === null) return null;

  const projection = structure.projection;
  const sendSelection = draftSelection ?? projection.thread.modelSelection;
  if (sendSelection.instanceId !== projection.thread.modelSelection.instanceId) return null;
  const { providerThread, liveUsage } = usageSample(projection);
  const contextWindow = deriveLatestContextWindowSnapshot(
    visibleTurnItems,
    liveUsage,
    providerThread,
  );
  if (contextWindow === null) return null;

  const phase = derivePhase(shell.runtime);
  const model = promptCacheModel({
    turns: projection.providerTurns,
    usage: liveUsage,
    sendModel: sendSelection.model,
  });
  const stateAt = (clientNowMs: number) =>
    promptCacheState({
      driver,
      model,
      usage: {
        usedTokens: contextWindow.usedTokens,
        updatedAt: contextWindow.updatedAt,
        promptCacheTtlMs: liveUsage?.promptCacheTtlMs,
        promptCacheExpiresAt: liveUsage?.promptCacheExpiresAt,
      },
      running: phase === "running" || phase === "connecting",
      nowMs: toServerClock(threadRef.environmentId, clientNowMs),
    });
  return {
    threadKey: scopedThreadKey(threadRef),
    state: stateAt(Date.parse(`${nowMinute}:00.000Z`)),
    stateAt,
    tokens: contextWindow.usedTokens,
    hitShare:
      contextWindow.lastInputTokens === null
        ? promptCacheHitShare(contextWindow)
        : promptCacheHitShare({
            inputTokens: contextWindow.lastInputTokens,
            cachedInputTokens: contextWindow.lastCachedInputTokens,
          }),
    prices: promptCachePrices({
      driver,
      model: promptCacheUsageModel(projection.providerTurns, liveUsage),
      overrides: settings?.usagePriceOverrides ?? NO_PRICES,
      aliases: settings?.usageModelAliases ?? NO_PRICES,
    }),
  };
}
