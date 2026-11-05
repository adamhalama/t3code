# adamhalama/t3code fork

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It installs next to
official T3 Code, updates itself only from this repository's releases, and follows each upstream
stable release automatically.

Everything that describes the fork lives in this `fork/` folder: this overview,
[UPDATE.md](UPDATE.md) (runbook for syncing with upstream), and [FEATURES.md](FEATURES.md) (fork
features).

## Branch model

- `fork/main` (default branch): the newest upstream stable tag (`vX.Y.Z`) plus a linear stack of
  fork commits. Releases are built from here.
- `fork/UPSTREAM_VERSION`: the upstream release `fork/main` sits on (`0.1.7`). The sync job and
  the release job both read it.
- `main`: mirrors upstream `main`. Nothing is built from it.
- Feature work lives on `fork/<name>` branches and lands in `fork/main` as a squash or rebase
  merge. Keep `fork/main` linear, because the sync replays its non-merge commits onto each new
  upstream tag, so conflict resolutions inside merge commits would be lost.

## Versioning

Releases are `<upstream>-fork.<n>`, tagged `v<upstream>-fork.<n>`, e.g. `v0.1.7-fork.1`.

- `n` is one more than the highest `n` already released or tagged for that upstream version
  (`scripts/fork-version.ts next`), and restarts at 1 on every new upstream release.
- semver orders them `0.1.7-fork.1 < 0.1.7-fork.2 < 0.1.8-fork.1`. The feed holds only fork
  versions, so the prerelease-style suffix never competes with a plain `0.1.7`.
- The build treats `-fork.N` as a stable build: product name `T3 Code (Fork)`, update channel
  `latest`. Package versions in the repo stay as upstream has them; the build stamps the release
  version (`--build-version`).

## Identity

Every identity value comes from one file,
[`packages/shared/src/forkIdentity.ts`](../packages/shared/src/forkIdentity.ts).

| What                                      | Upstream                               | Fork                                               |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------------- |
| Product / Start menu / uninstall entry    | `T3 Code`                              | `T3 Code (Fork)`                                   |
| appId (NSIS GUID, uninstall registry key) | `com.t3tools.t3code`                   | `com.adamhalama.t3code.fork`                       |
| AppUserModelId (taskbar, notifications)   | `com.t3tools.t3code(.dev)`             | `com.adamhalama.t3code.fork(.dev)`                 |
| Per-user install dir                      | `%LOCALAPPDATA%\Programs\t3code`       | `%LOCALAPPDATA%\Programs\t3code-fork`              |
| Updater cache                             | `%LOCALAPPDATA%\t3code-updater`        | `%LOCALAPPDATA%\t3code-fork-updater`               |
| userData (single-instance lock, profile)  | `t3code-v2` / `t3code-dev`             | `t3code-fork` / `t3code-fork-dev`                  |
| T3 home (host and inside WSL)             | `~/.t3`                                | `~/.t3-fork` (`T3CODE_HOME` still overrides)       |
| WSL runtime cache                         | `$HOME/.t3/wsl-runtime`                | `$HOME/.t3-fork/wsl-runtime`                       |
| URL scheme / renderer origin              | `t3code://`, `t3code-dev://`           | same as upstream (shared, see below)               |
| Installer file                            | `T3-Code-<ver>-x64.exe`                | `T3-Code-Fork-<ver>-x64.exe`                       |
| Linux executable / desktop entry          | `t3code`, `com.t3tools.T3Code.desktop` | `t3code-fork`, `com.adamhalama.T3CodeFork.desktop` |
| Update feed                               | pingdotgg/t3code releases              | adamhalama/t3code releases only                    |

Other collision points, checked:

- The single-instance lock lives in userData, so it is separate.
- The server port is chosen at startup (the first free port from 3773), so a running official app
  pushes the fork to the next port. The only named pipe (Codex token broker) has a random name.
- Auto-launch is not registered by the desktop app.
- The fork never imports upstream's profiles: no V1 local-storage import, and no
  `<appData>/t3code/Local State` fallback.
- The `t3code://` scheme is shared. It is the renderer origin, which T3 Connect's Clerk instance
  allowlists, and the deep link that hosted sign-ins return to: Clerk OAuth (`t3code://app/`),
  Codex handoff from app.t3.codes (`t3code://auth/codex`), and provider auth returns. A fork scheme
  breaks those flows. With both apps installed, the one that registered the scheme last (usually
  the last one launched) receives these links, and the other app's sign-in waits until it times
  out. Relaunch the app you want to sign in from first.

Unchanged on purpose:

- `installer.nsh` process names: they only affect messages, and the product-name fallback covers
  the fork.
- The `t3code` / `t3code-dev` schemes, including hosted and mobile pairing links (`t3code://pair`).
- The `t3` CLI service name and launchd label: these belong to the CLI, not the desktop app.

## Updates

The in-app checker, download, and "restart to update" flow are upstream's, unchanged, pointed at
this repository:

- `app-update.yml` in the build is `provider: github, owner: adamhalama, repo: t3code,
  channel: latest`. `T3CODE_DESKTOP_UPDATE_REPOSITORY` can override the repository at build time.
  `GITHUB_REPOSITORY` is ignored.
- The managed policy is shared with official T3 Code (`policy.json` under `T3Code`, or the
  `HKLM\SOFTWARE\Policies\T3Tools\T3Code` key). Its `limits.updates` applies to the fork too, and
  its `feedUrl` replaces the fork feed, so a policy written for the official app points the fork at
  that mirror. Remove `feedUrl` from the policy on machines that run the fork.
- electron-updater on `latest` reads GitHub's `releases/latest`, so fork releases are published,
  not prereleases, and marked latest. It downloads `latest.yml` and the installer named there.
- Nightly: none. The Stable/Nightly track picker in Settings is hidden
  (`FORK_HAS_NIGHTLY_UPDATES = false`).
- Unsigned: builds carry no `publisherName`, so the NSIS updater skips Authenticode verification
  and installs unsigned updates. `scripts/fork-desktop-build-config.test.ts` asserts this. Windows
  SmartScreen warns on the first manual install ("Windows protected your PC" → More info → Run
  anyway). Updates installed by the app are not prompted.

## Pipelines

Only `fork-*` workflows run in this repository. Every other workflow is disabled with
[`scripts/fork-disable-upstream-workflows.sh`](../scripts/fork-disable-upstream-workflows.sh),
never edited or deleted, so rebases never conflict on them. `release-desktop.yml` stays enabled
because `fork-release.yml` calls it.

**[`fork-release.yml`](../.github/workflows/fork-release.yml)** runs on pushes to `fork/main`,
pull requests into `fork/main` (build only), `workflow_dispatch`, and `workflow_call`.

1. `prepare` reads `fork/UPSTREAM_VERSION` and computes `<upstream>-fork.<n>`. It publishes only
   for `fork/main` and skips publishing if a fork release tag already points at the commit.
   Publishing runs wait for each other from this step on, so two runs never pick the same version.
2. `bundle` builds the JS bundle (`vp run build:desktop`) with the public T3 Connect values from
   `.env.example`.
3. `desktop` is a matrix over upstream's `release-desktop.yml`. Linux x64 is always built,
   because its CLI archive is the WSL runtime that the Windows installer embeds. Windows x64 is
   cross-built on Linux and its packaged natives are verified on `windows-2025`. No secrets are
   passed, so nothing is signed.
4. `assemble` collects the platforms in `PUBLISHED_PLATFORMS` (currently `win`), renames the
   manifest to `latest.yml`, and checks the version, installer, and blockmap. It uploads them as
   the `t3code-fork-<version>` artifact and, when publishing, runs
   `gh release create v<version> --latest`.

To add a platform, add a matrix entry, add it to `PUBLISHED_PLATFORMS`, and (for a second Windows
arch) merge the manifests with `scripts/merge-update-manifests.ts` as `release.yml` does.

**[`fork-sync.yml`](../.github/workflows/fork-sync.yml)** runs every 6 hours and on
`workflow_dispatch`, with an optional `upstream_version` override and `dry_run` input. It runs
[`scripts/fork-sync.ts`](../scripts/fork-sync.ts):

1. Find the newest published, non-prerelease upstream `vX.Y.Z` and compare it with
   `fork/UPSTREAM_VERSION`.
2. If it is newer, rebase the fork commits (`v<old>..fork/main`) onto `v<new>`, dropping the
   previous sync commit, and commit the new `fork/UPSTREAM_VERSION` as
   `chore(fork): sync to upstream v<new> [skip ci]`.
3. Run `vp install`, `vp run typecheck` in every package the fork touches, and those packages'
   tests related to the fork's changes (`vp test related`).
4. If everything passes, push `fork/main` with `--force-with-lease`, disable any new upstream
   workflows, and dispatch `fork-release.yml`. The dispatch runs the new commit's workflow files,
   and `[skip ci]` keeps the push from starting a second release.
5. If anything fails, push nothing. Open or update an issue labelled `fork-sync-failed` with the
   failing step, conflicting files, and a repro command (see [UPDATE.md](UPDATE.md)).

One-time repository setup:

- Secret `FORK_SYNC_TOKEN`: a fine-grained token for adamhalama/t3code with Contents and Workflows
  read/write. `GITHUB_TOKEN` may not push changes under `.github/workflows`. Without the secret,
  sync runs as a dry run.
- Issues enabled, so failure reports become issues. Otherwise they only appear in the run summary.

## Patch surface

Upstream files the fork changes. Every hunk is marked with a `fork:` comment; all values come from
`forkIdentity.ts`. Test files updated for the new identity values carry a `// fork:` header.

| Upstream file                                                                    | +/-     | Change                                                                                        |
| -------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `scripts/build-desktop-artifact.ts`                                              | +13 −10 | appId, productName, artifact name, Linux exe, package name, publish feed and `latest` channel |
| `packages/shared/package.json`                                                   | +4      | export `./forkIdentity`                                                                       |
| `apps/web/src/components/settings/SettingsPanels.tsx`                            | +3 −1   | hide the update-track picker                                                                  |
| `apps/desktop/src/app/DesktopEarlyElectronStartup.ts`                            | +5 −1   | Linux desktop entry name                                                                      |
| `apps/desktop/src/app/DesktopEnvironment.ts`                                     | +10 −2  | display name, AppUserModelId                                                                  |
| `apps/desktop/src/app/DesktopLegacyLocalStorage.ts`                              | +2 −1   | no V1 profile import                                                                          |
| `apps/desktop/src/app/DesktopStatePaths.ts`                                      | +4 −2   | default home `~/.t3-fork`                                                                     |
| `apps/desktop/src/app/DesktopUserData.ts`                                        | +6 −5   | userData names, no upstream `Local State` fallback                                            |
| `apps/desktop/src/backend/DesktopBackendConfiguration.ts`                        | +3      | WSL server home `~/.t3-fork`                                                                  |
| `apps/desktop/src/wsl/DesktopWslEnvironment.ts`                                  | +7 −3   | WSL runtime cache under `~/.t3-fork`                                                          |
| `AGENTS.md`                                                                      | +6      | "Fork" section                                                                                |
| Tests (7 files, `apps/desktop/src/**`, `scripts/build-desktop-artifact.test.ts`) | small   | expected values follow `forkIdentity.ts`                                                      |

Fork-owned files (no upstream conflicts possible): `fork/**`, `.github/workflows/fork-*.yml`,
`scripts/fork-*`, `packages/shared/src/forkIdentity*.ts`,
`apps/desktop/src/app/DesktopUserData.fork.test.ts`.
