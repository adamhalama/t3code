export type PromptCacheColdSendChoice = "compact" | "keep" | "cancel";

/** How the composer's send consults the prompt cache when it plans a turn. */
export interface PromptCacheSendGate {
  /** The tokens a send compacts first at the current time, or null when it sends as is. */
  readonly resumeCompactionTokens: () => number | null;
  /** Opens the cold-send dialog when the cache is known cold, or returns null without asking. */
  readonly ask: () => Promise<PromptCacheColdSendChoice> | null;
}

type PlannedWithPromptCache<Plan> = Plan & { readonly coldSendCancelled: boolean };

/**
 * Plans a composer turn with the resume-compaction decision taken at send time, asking first when
 * it would compact a thread whose cache is known cold. Returns a promise only when the dialog
 * opens. "Send anyway" plans again with the full history kept for this send only.
 */
export function planComposerTurnWithPromptCache<
  Input extends {
    readonly resumeCompactionTokens: number | null;
    readonly keepFullHistory: boolean;
  },
  Plan extends { readonly compactBeforeSend: boolean },
>(
  gate: PromptCacheSendGate | undefined,
  plan: (input: Input) => Plan,
  input: Input,
): PlannedWithPromptCache<Plan> | Promise<PlannedWithPromptCache<Plan>> {
  const atSend =
    gate === undefined
      ? input
      : { ...input, resumeCompactionTokens: gate.resumeCompactionTokens() };
  const planned = plan(atSend);
  const asking = planned.compactBeforeSend ? gate?.ask() : null;
  if (asking == null) return { ...planned, coldSendCancelled: false };
  return asking.then((choice) =>
    choice === "keep"
      ? { ...plan({ ...atSend, keepFullHistory: true }), coldSendCancelled: false }
      : { ...planned, coldSendCancelled: choice === "cancel" },
  );
}
