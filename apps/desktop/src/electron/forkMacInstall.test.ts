// @effect-diagnostics nodeBuiltinImport:off -- Integration fixtures exercise the real Mac archive and installer tools in temporary bundles.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { assert, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HostProcess from "@t3tools/shared/HostProcess";

import { FORK_DESKTOP_APP_ID } from "@t3tools/shared/forkIdentity";

import { stageForkMacUpdate } from "./forkMacInstall.ts";

const run = NodeUtil.promisify(NodeChildProcess.execFile);

async function fixture() {
  const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-fork-update-"));
  return {
    root,
    async [Symbol.asyncDispose]() {
      await NodeFSP.rm(root, { recursive: true, force: true });
    },
  };
}

async function archive(root: string, identity = FORK_DESKTOP_APP_ID, version = "0.1.9-fork.3") {
  const app = NodePath.join(root, "release", "T3 Code (Fork).app");
  await NodeFSP.mkdir(NodePath.join(app, "Contents", "MacOS"), { recursive: true });
  await NodeFSP.writeFile(
    NodePath.join(app, "Contents", "Info.plist"),
    `<?xml version="1.0"?><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${identity}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleExecutable</key><string>Fork Fixture</string>
</dict></plist>`,
  );
  await NodeFSP.writeFile(
    NodePath.join(app, "Contents", "MacOS", "Fork Fixture"),
    "#!/bin/sh\nexit 0\n",
    {
      mode: 0o755,
    },
  );
  const zip = NodePath.join(root, "release.zip");
  await run("/usr/bin/ditto", ["-c", "-k", "--keepParent", app, zip]);
  return zip;
}

it.live("replaces a staged fork app and restores the old app if replacement fails", () =>
  Effect.gen(function* () {
    if ((yield* HostProcess.Platform) !== "darwin") return;
    yield* Effect.promise(async () => {
      await using temporary = await fixture();
      const target = NodePath.join(temporary.root, "Applications", "T3 Code (Fork).app");
      await NodeFSP.mkdir(target, { recursive: true });
      await NodeFSP.writeFile(NodePath.join(target, "original"), "keep me");
      const zip = await archive(temporary.root);
      const stage = () => stageForkMacUpdate({ archive: zip, target, version: "0.1.9-fork.3" });
      const failed = await stage();
      await NodeFSP.rm(failed.staged, { recursive: true });
      const exited = run("/usr/bin/true");
      const exitedPid = String(exited.child.pid);
      await exited;
      await expect(
        run("/bin/sh", [failed.script, exitedPid, target, failed.directory, failed.executable]),
      ).rejects.toThrow();
      assert.equal(await NodeFSP.readFile(NodePath.join(target, "original"), "utf8"), "keep me");

      const ready = await stage();
      const parent = NodeChildProcess.spawn("/bin/cat");
      using _parent = {
        [Symbol.dispose]() {
          if (parent.exitCode === null) parent.kill();
        },
      };
      const installation = run("/bin/sh", [
        ready.script,
        String(parent.pid),
        target,
        ready.directory,
        ready.executable,
      ]);
      await new Promise<void>((resolve, reject) => {
        installation.child.stdout!.once("data", () => resolve());
        installation.catch(reject);
      });
      assert.equal(await NodeFSP.readFile(NodePath.join(target, "original"), "utf8"), "keep me");
      parent.stdin.end();
      const installed = await installation;
      assert.include(installed.stdout, "Installed");
      assert.isTrue((await NodeFSP.stat(NodePath.join(target, "Contents", "Info.plist"))).isFile());
      await expect(NodeFSP.stat(NodePath.join(target, "original"))).rejects.toThrow();
      await expect(NodeFSP.stat(ready.directory)).rejects.toThrow();
    });
  }),
);

it.live("rejects another app or version without touching the installed app", () =>
  Effect.gen(function* () {
    if ((yield* HostProcess.Platform) !== "darwin") return;
    yield* Effect.promise(async () => {
      await using temporary = await fixture();
      const target = NodePath.join(temporary.root, "T3 Code (Fork).app");
      await NodeFSP.mkdir(target);
      await NodeFSP.writeFile(NodePath.join(target, "original"), "keep me");
      const zip = await archive(temporary.root);
      await expect(
        stageForkMacUpdate({ archive: zip, target, version: "0.1.9-fork.99" }),
      ).rejects.toThrow("version does not match");
      const other = await archive(temporary.root, "com.example.other");
      await expect(
        stageForkMacUpdate({ archive: other, target, version: "0.1.9-fork.3" }),
      ).rejects.toThrow("not T3 Code (Fork)");
      assert.equal(await NodeFSP.readFile(NodePath.join(target, "original"), "utf8"), "keep me");
      assert.deepEqual((await NodeFSP.readdir(temporary.root)).sort(), [
        "T3 Code (Fork).app",
        "release",
        "release.zip",
      ]);
    });
  }),
);
