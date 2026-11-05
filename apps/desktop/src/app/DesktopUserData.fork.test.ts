// fork: the fork must never read or reuse upstream T3 Code's profiles (fork/README.md).
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { resolveDesktopBaseDir } from "./DesktopStatePaths.ts";
import { resolveUserDataPath } from "./DesktopUserData.ts";

it.effect.each(["t3code", "t3code-v2", "T3 Code (Alpha)"])(
  "does not copy upstream's %s credential keys into the fork profile",
  (upstreamName) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-fork-profile-" });
      yield* fs.makeDirectory(path.join(directory, upstreamName), { recursive: true });
      yield* fs.writeFileString(path.join(directory, upstreamName, "Local State"), "upstream");

      const userData = yield* resolveUserDataPath({
        appDataDirectory: directory,
        isDevelopment: false,
        platform: "win32",
      });

      assert.equal(userData, path.join(directory, "t3code-fork"));
      assert.isFalse(yield* fs.exists(path.join(userData, "Local State")));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("keeps development and production fork profiles apart from upstream's", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const input = { appDataDirectory: "/no/such/app-data", platform: "linux" as const };
    assert.equal(
      yield* resolveUserDataPath({ ...input, isDevelopment: false }),
      path.join(input.appDataDirectory, "t3code-fork"),
    );
    assert.equal(
      yield* resolveUserDataPath({ ...input, isDevelopment: true }),
      path.join(input.appDataDirectory, "t3code-fork-dev"),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);

it("defaults the T3 home to ~/.t3-fork", () => {
  const joinPath = (...segments: string[]) => segments.join("/");
  assert.equal(
    resolveDesktopBaseDir({ homeDirectory: "/home/a", joinPath, t3Home: Option.none() }),
    "/home/a/.t3-fork",
  );
  assert.equal(
    resolveDesktopBaseDir({ homeDirectory: "/home/a", joinPath, t3Home: Option.some("/x") }),
    "/x",
  );
});
