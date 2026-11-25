import { describe, expect, it } from "vite-plus/test";

import {
  planComposerTurnWithPromptCache,
  type PromptCacheColdSendChoice,
} from "./promptCacheSend.logic";

const plan = (input: { resumeCompactionTokens: number | null; keepFullHistory: boolean }) => ({
  compactBeforeSend: input.resumeCompactionTokens !== null && !input.keepFullHistory,
});

const rendered = { resumeCompactionTokens: 412_000, keepFullHistory: false };

function gate(atSend: number | null, answer: PromptCacheColdSendChoice | null) {
  return {
    resumeCompactionTokens: () => atSend,
    ask: () => (answer === null ? null : Promise.resolve(answer)),
  };
}

describe("planComposerTurnWithPromptCache", () => {
  it("plans synchronously with the send-time decision when no dialog opens", () => {
    expect(planComposerTurnWithPromptCache(gate(null, "compact"), plan, rendered)).toEqual({
      compactBeforeSend: false,
      coldSendCancelled: false,
    });
    expect(planComposerTurnWithPromptCache(gate(412_000, null), plan, rendered)).toEqual({
      compactBeforeSend: true,
      coldSendCancelled: false,
    });
  });

  it.each([
    { answer: "compact", expected: { compactBeforeSend: true, coldSendCancelled: false } },
    { answer: "keep", expected: { compactBeforeSend: false, coldSendCancelled: false } },
    { answer: "cancel", expected: { compactBeforeSend: true, coldSendCancelled: true } },
  ] as const)("waits for the dialog's $answer", async ({ answer, expected }) => {
    const planned = planComposerTurnWithPromptCache(gate(412_000, answer), plan, rendered);
    expect(planned).toBeInstanceOf(Promise);
    expect(await planned).toEqual(expected);
  });
});
