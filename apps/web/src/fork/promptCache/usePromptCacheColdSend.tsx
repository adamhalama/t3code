import { toServerClock } from "@t3tools/client-runtime/clock";
import {
  formatPromptCacheMinutesAgo,
  type PromptCachePrices,
} from "@t3tools/client-runtime/state/prompt-cache";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { useEffect, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { PromptCacheCostRows } from "./PromptCacheCostRows";
import type { PromptCacheColdSendChoice, PromptCacheSendGate } from "./promptCacheSend.logic";
import { useAskBeforeColdSend, useProvideThreadCompaction } from "./promptCacheStore";
import { usePromptCacheView } from "./usePromptCacheView";

interface PendingColdSend {
  readonly threadKey: string;
  readonly tokens: number;
  readonly msSince: number;
  readonly prices: PromptCachePrices | null;
  readonly resolve: (choice: PromptCacheColdSendChoice) => void;
}

/**
 * The thread view's side of the prompt cache: publishes its compaction to the header, composer
 * chip and command palette, and asks before a send compacts a thread whose cache is known cold.
 */
export function usePromptCacheColdSend(input: {
  readonly threadRef: ScopedThreadRef;
  readonly threadKey: string;
  /** The upstream resume-compaction decision at an ISO time. */
  readonly resumeCompactionTokensAt: (now: string) => number | null;
  readonly onCompactContext: () => void;
  readonly compactDisabled: boolean;
}): {
  readonly gate: PromptCacheSendGate;
  readonly dialog: ReactNode;
} {
  const { threadKey } = input;
  useProvideThreadCompaction(threadKey, input.onCompactContext, input.compactDisabled);
  const view = usePromptCacheView(input.threadRef);
  const [askBeforeColdSend, setAskBeforeColdSend] = useAskBeforeColdSend();
  const [pending, setPending] = useState<PendingColdSend | null>(null);

  const gate: PromptCacheSendGate = {
    resumeCompactionTokens: () =>
      input.resumeCompactionTokensAt(
        new Date(toServerClock(input.threadRef.environmentId, Date.now())).toISOString(),
      ),
    ask: () => {
      if (!askBeforeColdSend || view === null) return null;
      const state = view.stateAt(Date.now());
      if (state?.kind !== "cold") return null;
      pending?.resolve("cancel");
      return new Promise((resolve) =>
        setPending({
          threadKey,
          tokens: state.tokens,
          msSince: state.msSince,
          prices: view.prices,
          resolve,
        }),
      );
    },
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a send awaits the dialog; leaving the thread or unmounting cancels it
  useEffect(() => {
    if (pending === null || pending.threadKey !== threadKey) return;
    return () => {
      pending.resolve("cancel");
      setPending((current) => (current === pending ? null : current));
    };
  }, [pending, threadKey]);

  const shown = pending !== null && pending.threadKey === threadKey ? pending : null;
  const resolve = (choice: PromptCacheColdSendChoice, dontAskAgain = false) => {
    if (pending === null) return;
    setPending(null);
    if (dontAskAgain) setAskBeforeColdSend(false);
    pending.resolve(choice);
  };

  return {
    gate,
    dialog: (
      <AlertDialog
        open={shown !== null}
        onOpenChange={(open) => {
          if (!open) resolve("cancel");
        }}
      >
        {shown === null ? null : <ColdSendDialogPopup pending={shown} onResolve={resolve} />}
      </AlertDialog>
    ),
  };
}

function ColdSendDialogPopup(props: {
  readonly pending: PendingColdSend;
  readonly onResolve: (choice: PromptCacheColdSendChoice, dontAskAgain: boolean) => void;
}) {
  const { tokens, msSince, prices } = props.pending;
  const [dontAskAgain, setDontAskAgain] = useState(false);
  return (
    <AlertDialogPopup>
      <AlertDialogHeader>
        <AlertDialogTitle>Prompt cache expired</AlertDialogTitle>
        <AlertDialogDescription>
          {`This thread's prompt cache went cold ${formatPromptCacheMinutesAgo(msSince)} ago. Sending now writes all ${formatTokens(tokens)} tokens of context to the cache again.`}
        </AlertDialogDescription>
        <PromptCacheCostRows tokens={tokens} prices={prices} />
        <Label>
          <Checkbox
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked)}
          />
          Don't ask again
        </Label>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
        <Button variant="outline" onClick={() => props.onResolve("keep", dontAskAgain)}>
          Send anyway
        </Button>
        <Button onClick={() => props.onResolve("compact", dontAskAgain)}>Compact first</Button>
      </AlertDialogFooter>
    </AlertDialogPopup>
  );
}
