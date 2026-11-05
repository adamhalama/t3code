// fork: the fork's installer identity and update feed (fork/README.md).
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";

import {
  createBuildConfig,
  resolveDesktopProductName,
  resolveDesktopUpdateChannel,
  resolveGitHubPublishConfig,
} from "./build-desktop-artifact.ts";

const upstreamCi = ConfigProvider.layer(
  ConfigProvider.fromEnv({ env: { GITHUB_REPOSITORY: "pingdotgg/t3code" } }),
);

it.layer(NodeServices.layer)("fork desktop build config", (it) => {
  it("treats -fork.N versions as stable releases", () => {
    assert.equal(resolveDesktopUpdateChannel("0.1.7-fork.1"), "latest");
    assert.equal(resolveDesktopProductName("0.1.7-fork.1"), "T3 Code (Fork)");
  });

  it.effect("publishes the Windows installer to the fork's latest feed only", () =>
    Effect.gen(function* () {
      const config = yield* createBuildConfig(
        "win",
        "nsis",
        "0.1.7-fork.1",
        false,
        false,
        undefined,
        undefined,
      );
      assert.equal(config.appId, "com.adamhalama.t3code.fork");
      assert.equal(config.productName, "T3 Code (Fork)");
      assert.equal(config.artifactName, "T3-Code-Fork-${version}-${arch}.${ext}");
      // Pinned "latest" keeps electron-builder from deriving a "fork" channel (fork.yml) from -fork.N.
      assert.deepStrictEqual(config.publish, [
        {
          provider: "github",
          owner: "adamhalama",
          repo: "t3code",
          releaseType: "release",
          channel: "latest",
        },
      ]);
      // Unsigned: no publisherName, so electron-updater skips signature verification.
      assert.notProperty(config.win as object, "signtoolOptions");
      assert.notProperty(config.win as object, "azureSignOptions");
    }).pipe(Effect.provide(upstreamCi)),
  );

  it.effect("ignores GITHUB_REPOSITORY but honors an explicit update repository", () =>
    Effect.gen(function* () {
      const fromCi = yield* resolveGitHubPublishConfig("latest").pipe(Effect.provide(upstreamCi));
      assert.equal(fromCi?.owner, "adamhalama");
      const explicit = yield* resolveGitHubPublishConfig("latest").pipe(
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnv({ env: { T3CODE_DESKTOP_UPDATE_REPOSITORY: "someone/else" } }),
          ),
        ),
      );
      assert.equal(explicit?.owner, "someone");
    }),
  );
});
