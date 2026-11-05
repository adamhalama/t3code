/**
 * fork: identity of the adamhalama/t3code fork, so it runs next to official T3 Code without sharing
 * an install, profile, data directory, or update feed. Read at `fork:` call sites. The `t3code://`
 * scheme stays upstream's: hosted Clerk and Codex sign-in only return to it (see fork/README.md).
 * @module forkIdentity
 */

/** Installer and executable name (`T3 Code (Fork).exe`, Start menu entry, uninstall entry). */
export const FORK_PRODUCT_NAME = "T3 Code (Fork)";

/** electron-builder appId; the NSIS GUID and uninstall key derive from it. */
export const FORK_DESKTOP_APP_ID = "com.adamhalama.t3code.fork";

/** Windows AppUserModelId (taskbar grouping, notifications). */
export const FORK_DESKTOP_APP_USER_MODEL_ID = {
  production: FORK_DESKTOP_APP_ID,
  development: `${FORK_DESKTOP_APP_ID}.dev`,
} as const;

/** Electron userData folder names under the OS app-data directory. The single-instance lock lives here. */
export const FORK_DESKTOP_USER_DATA = {
  production: { current: "t3code-fork", legacy: "T3 Code (Fork)" },
  development: { current: "t3code-fork-dev", legacy: "T3 Code (Fork Dev)" },
} as const;

/** Default T3 home (`~/.t3-fork`) on the host and inside WSL distros. `T3CODE_HOME` still overrides it. */
export const FORK_T3_HOME_DIR_NAME = ".t3-fork";

/**
 * Packaged app name. NSIS uses it for the per-user install dir (`%LOCALAPPDATA%\Programs\t3code-fork`)
 * and the updater cache dir (`%LOCALAPPDATA%\t3code-fork-updater`).
 */
export const FORK_PACKAGE_NAME = "t3code-fork";

/** Linux executable, StartupWMClass, and .desktop entry names. */
export const FORK_LINUX_EXECUTABLE_NAME = "t3code-fork";
export const FORK_LINUX_DESKTOP_ENTRY_NAME = {
  production: "com.adamhalama.T3CodeFork.desktop",
  development: "com.adamhalama.T3CodeFork.Development.desktop",
} as const;

/** GitHub repository whose Releases are the only update feed. */
export const FORK_UPDATE_REPOSITORY = "adamhalama/t3code";

/** The fork publishes stable releases only, so the Stable/Nightly track picker is hidden. */
export const FORK_HAS_NIGHTLY_UPDATES: boolean = false;

/**
 * The fork's macOS builds carry no Developer ID signature. Squirrel.Mac installs an update only
 * when its signature satisfies the running app's designated requirement, which an unsigned or
 * ad-hoc signed app does not have, so every in-app install would fail.
 */
const FORK_MAC_BUILDS_SIGNED: boolean = false;

/** Why the in-app updater stays off on `platform`, or null where it installs fork releases itself. */
export function forkManualUpdateReason(platform: string): string | null {
  if (platform !== "darwin" || FORK_MAC_BUILDS_SIGNED) return null;
  return `This Mac build is unsigned, so it cannot update itself. Download the latest release from https://github.com/${FORK_UPDATE_REPOSITORY}/releases/latest and replace the app in Applications.`;
}

/** Window title and app name: `T3 Code (Fork)`, `T3 Code (Fork Dev)`, `T3 Code (Fork Nightly)`. */
export function forkDesktopDisplayName(baseName: string, stageLabel: string): string {
  return stageLabel === "Beta" || stageLabel === "Alpha"
    ? `${baseName} (Fork)`
    : `${baseName} (Fork ${stageLabel})`;
}

/**
 * Fork release versions are `<upstream>-fork.<n>`, e.g. `0.1.7-fork.2`. semver orders them as
 * prereleases of the upstream version, which is fine because the fork feed only ever holds fork
 * versions: `0.1.7-fork.2 > 0.1.7-fork.1` and `0.1.8-fork.1 > 0.1.7-fork.9`.
 */
const FORK_VERSION_PATTERN = /^(\d+\.\d+\.\d+)-fork\.(\d+)$/;

export function parseForkVersion(
  version: string,
): { readonly upstream: string; readonly n: number } | null {
  const match = FORK_VERSION_PATTERN.exec(version.trim());
  if (!match) return null;
  return { upstream: match[1]!, n: Number(match[2]) };
}

export function isForkVersion(version: string): boolean {
  return parseForkVersion(version) !== null;
}
