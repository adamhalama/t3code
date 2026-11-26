# Prompt cache: design

Shows whether the open thread's prompt cache is still warm, and asks before a send would pay to
re-write a large cold cache. Client only: no server, contract or provider change, so it works
against any T3 Code server, including an upstream one.

## What the user sees

- **Chip in the composer**, next to the send button and the **Compact** toggle, and a **badge in
  the thread header**. Warm reads `3 min left` (`< 1 min left` in the last minute) in a quiet
  style. Cold reads `Cache cold · 14 min · 412K`, in error colours from 100K tokens and in the
  same quiet style as warm below that. Both are hidden while a turn runs, before the first turn,
  for providers and models whose cache lifetime is unknown, and once the next send would go to
  another model than the one that produced the last reply, including a model just picked in the
  composer, since that model's cache starts empty. They update once a minute, with no animation.
- **Popover** on either: state and expiry time (in this device's time), how much of the last
  reply's input came from the cache, the three cost rows below, **Compact now**, and **Ask before a cold send**, which turns
  the cold-send dialog back on after **Don't ask again**.
- **Cold-send dialog.** When a send would compact first (the composer shows **Compact 412K**,
  for threads of 100K tokens or more) and the cache is known to be cold at that moment, the dialog asks how to continue: **Compact first**
  (the existing compact-then-send), **Send anyway** (keeps the full history for this send only,
  leaving the toggle as it was), or **Cancel**. **Don't ask again** turns it off, and the toggle
  alone decides again. The send decides with the current time to the second, not the minute the
  chip last showed.
- **Command palette:** **Compact thread** compacts the open thread through the same `/compact`
  path as the composer.

Cost rows, each marked `≈`:

- **Continue cold:** the whole context written to the cache again.
- **Compact first:** the one-time compaction (the cold context read once for the summary, the
  summary's output, and the smaller context written), the context left after it, and what each
  later message saves.
- **Start a new thread:** a new thread's base context written.

## Where things live

- `packages/client-runtime/src/state/promptCache.ts`: the cache lifetime table
  (`OPENCODE_PROMPT_CACHE_TTLS`) and turn-end margin, the warm and cold state, minute formatting,
  price lookup, the cost rows and their constants, and `isWorthWarning`. Unit tests beside it.
- The size threshold is 100K tokens, `WARNING_MIN_TOKENS` in `promptCache.ts`, read only through
  `isWorthWarning`. It gates the chip's error style, the **Compact** toggle and so the dialog, for
  OpenCode and Claude Code alike. Upstream's `COMPACTION_SUGGESTION_MIN_TOKENS` (200K) stays as it
  is for its other uses, such as the server's **Before the cache expires (beta)**. The chip shows
  the cache state at any size.
- Cache lifetimes: OpenCode with Claude through GitHub Copilot or Anthropic, 5 minutes; OpenCode
  with GPT through GitHub Copilot, 25 minutes. The OpenCode model entry **Claude Opus 5.5
  (planner, 150K)** (`OPENCODE_KEEP_WARM_MODEL`, next to the table) is warm for 20 minutes after
  its last reply, with no margin, because OpenCode keeps its cache warm with requests the client
  can't see. It is matched by its model ID after the provider prefix, which OpenCode records for
  the turn as it does for the selection. Claude Code reports its own expiry, or else its own
  lifetime. Every other provider and model has none, so it shows nothing and never prompts. The
  lifetime and prices follow the model the provider turn recorded for the last reply, not the
  model picker.
- The upstream resume-compaction gate, `shouldOfferResumeCompaction` in
  `packages/client-runtime/src/state/contextWindow.ts`, asks `promptCacheResumeCompaction` first,
  so OpenCode threads get the **Compact** toggle with these lifetimes. Claude Code keeps the
  upstream rule, including its fallback lifetime, for the toggle, with the threshold above; the
  dialog never uses that fallback.
- The composer's send (`useComposerSend.ts`) plans its turn through
  `planComposerTurnWithPromptCache` (`promptCacheSend.logic.ts`), after it has handled local
  commands and queued-message edits. The send-time gate decides alone, even when the composer last
  showed **Compact**. The send stays synchronous unless the dialog opens; then it waits for the
  answer, and **Send anyway** plans again with the full history kept. Leaving the thread cancels
  an open dialog's send.
- `apps/web/src/fork/promptCache/`: the chip and popover, the cost rows, the dialog
  (`usePromptCacheColdSend.tsx`), the send planning, the palette entry, and `promptCacheStore.ts`.
  The store holds the "ask before a cold send" choice in local storage and lets the header, composer and
  palette reach the thread view's compaction.

## Known limitations

- OpenCode stamps usage when a turn ends, but the cache clock starts with the last request. The
  lifetime is shortened by a one-minute margin, so a long final request can still make the chip
  read warm slightly too long.
- Requests the provider makes on its own, such as keep-alive or warming requests, are invisible
  to the client. A cache they keep warm still reads cold, except for the planner entry above,
  whose warm window is configured here to match.
- After a compaction, OpenCode reports no usage, so T3 Code's context meter keeps the
  pre-compaction size, and the cache state is hidden until the next reply reports usage.
- Prices come only from the Usage page's price overrides, matched by the recorded model name after
  model aliases. Without an override for the model, the rows show tokens only.
- Switching models in Claude Code isn't detected, because Claude Code records a model's full ID
  where the picker holds its short name. The chip keeps following Claude Code's reported expiry.
- The mobile app shows no chip or dialog, and does not compact OpenCode threads before sending.
  It shares the Claude Code gate, so its compact-before-send for Claude Code threads also starts
  at 100K.
- Cost rows use fixed estimates for the summary size, a new thread's base context and the model
  calls per message. They are in `promptCache.ts`.
