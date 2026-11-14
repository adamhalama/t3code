// @effect-diagnostics nodeBuiltinImport:off -- Native filesystem and subprocess boundary for the fork's unsigned Mac installer.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { FORK_DESKTOP_APP_ID } from "@t3tools/shared/forkIdentity";

const run = NodeUtil.promisify(NodeChildProcess.execFile);

export async function stageForkMacUpdate(input: {
  archive: string;
  target: string;
  version: string;
}) {
  const target = await NodeFSP.realpath(input.target);
  if (!target.endsWith(".app"))
    throw new Error("Install the fork in Applications before updating.");
  // Staging beside the app makes both rename operations stay on the same filesystem.
  const directory = await NodeFSP.mkdtemp(
    NodePath.join(NodePath.dirname(target), ".t3code-fork-update-"),
  );
  try {
    await NodeFSP.chmod(directory, 0o700);
    const extracted = NodePath.join(directory, "extracted");
    await run("/usr/bin/ditto", ["-x", "-k", input.archive, extracted]);
    const apps = (await NodeFSP.readdir(extracted)).filter((name) => name.endsWith(".app"));
    if (apps.length !== 1) throw new Error("The update must contain exactly one app.");
    const appPath = NodePath.join(extracted, apps[0]!);
    if ((await NodeFSP.lstat(appPath)).isSymbolicLink())
      throw new Error("The update app is a symlink.");
    const plist = NodePath.join(appPath, "Contents", "Info.plist");
    const readProperty = async (key: string) =>
      (await run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist])).stdout.trim();
    if ((await readProperty("CFBundleIdentifier")) !== FORK_DESKTOP_APP_ID) {
      throw new Error("The update is not T3 Code (Fork).");
    }
    if ((await readProperty("CFBundleShortVersionString")) !== input.version) {
      throw new Error("The update version does not match the release.");
    }
    const executable = await readProperty("CFBundleExecutable");
    if (!executable || NodePath.basename(executable) !== executable) {
      throw new Error("The update executable is invalid.");
    }
    const executablePath = await NodeFSP.realpath(
      NodePath.join(appPath, "Contents", "MacOS", executable),
    );
    if (!executablePath.startsWith(`${appPath}${NodePath.sep}`)) {
      throw new Error("The update executable is outside the app.");
    }
    await NodeFSP.access(executablePath, NodeFS.constants.X_OK);
    await run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", appPath]);
    const staged = NodePath.join(directory, "update.app");
    await NodeFSP.rename(appPath, staged);
    const script = NodePath.join(directory, "install.sh");
    await NodeFSP.writeFile(script, forkMacInstallScript, { mode: 0o700 });
    return { directory, staged, target, executable, script };
  } catch (error) {
    await NodeFSP.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

// Wait for the exact parent process; never replace a bundle while its desktop backend is running.
const forkMacInstallScript = `#!/bin/sh
set -eu
parent="$1"
target="$2"
directory="$3"
executable="$4"
backup="$directory/previous.app"
attempt=0
echo "Waiting for app process $parent to exit"
while /bin/kill -0 "$parent" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 120 ]; then
    echo "Update cancelled: the app did not quit. Staged update: $directory" >&2
    exit 1
  fi
  /bin/sleep 1
done
restore() {
  if [ ! -e "$target" ] && [ -d "$backup" ]; then
    /bin/mv "$backup" "$target"
  fi
}
trap restore EXIT
/bin/mv "$target" "$backup"
/bin/mv "$directory/update.app" "$target"
trap - EXIT
echo "Installed $target"
"$target/Contents/MacOS/$executable" </dev/null &
/bin/rm -rf "$directory"
`;
