// fork: unsigned Mac builds use the same update controls as Windows.
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";

import * as DesktopUpdatePolicy from "./DesktopUpdatePolicy.ts";
import * as DesktopUpdates from "./DesktopUpdates.ts";
import { makeHarness } from "./updatesTestHarness.ts";

describe("DesktopUpdates in the fork", () => {
  const configuredState = (platform: NodeJS.Platform, mockUpdates: boolean) => {
    const harness = makeHarness({
      platform,
      env: { T3CODE_DESKTOP_MOCK_UPDATES: String(mockUpdates) },
      // A feed without the mock server, as a packaged build reads from app-update.yml.
      policy: { ...DesktopUpdatePolicy.unmanagedUpdatePolicy, feedUrl: "https://example.com/feed" },
    });
    return Effect.scoped(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        yield* TestClock.adjust("10 minutes");
        return {
          state: yield* updates.getState,
          reason: yield* updates.disabledReason,
          checks: harness.checkCount(),
        };
      }),
    ).pipe(Effect.provide(Layer.merge(TestClock.layer(), harness.layer)));
  };

  it.effect("checks for releases on macOS and Windows", () =>
    Effect.gen(function* () {
      const mac = yield* configuredState("darwin", false);
      assert.isTrue(mac.state.enabled);
      assert.isTrue(Option.isNone(mac.reason));
      assert.isAbove(mac.checks, 0);

      const windows = yield* configuredState("win32", false);
      assert.isTrue(windows.state.enabled);
      assert.isAbove(windows.checks, 0);

      const mockedMac = yield* configuredState("darwin", true);
      assert.isTrue(mockedMac.state.enabled);
    }),
  );
});
