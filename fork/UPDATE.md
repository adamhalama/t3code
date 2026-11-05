# Updating the fork to a new upstream release

Runbook for an agent or human moving `fork/main` onto a new upstream stable release. Usually
[`fork-sync.yml`](../.github/workflows/fork-sync.yml) does this by itself every 6 hours. Use
this runbook when it opened a `fork-sync-failed` issue, or to sync by hand.

## Rules

- Never push `fork/main` until the checks below pass. Always use `--force-with-lease`.
- Keep `fork/main` linear: upstream tag, then fork commits, then one
  `chore(fork): sync to upstream vX.Y.Z [skip ci]` commit.
- Resolve conflicts in favour of upstream's new code, then re-apply the fork's intent. Keep every
  upstream hunk small and marked with a `fork:` comment. Identity values come from
  `packages/shared/src/forkIdentity.ts`, never inline strings.
- If an upstream change makes a fork hunk unnecessary, drop the hunk and update the "Patch
  surface" table in [README.md](README.md).

## 1. Reproduce

```sh
git clone https://github.com/adamhalama/t3code.git t3code-sync && cd t3code-sync
git remote add upstream https://github.com/pingdotgg/t3code.git
vp install
node scripts/fork-sync.ts --dry-run --upstream-version X.Y.Z   # omit the version for the newest
```

`--dry-run` does everything except push. `--skip-checks` stops after the rebase. On success, the
rebased branch is left as `fork-sync/vX.Y.Z`.

## 2. Resolve a rebase conflict

The issue lists the fork commit being applied and the conflicting files. By hand:

```sh
old=$(cat fork/UPSTREAM_VERSION); new=X.Y.Z
git fetch upstream "refs/tags/v$old:refs/tags/v$old" "refs/tags/v$new:refs/tags/v$new"
git checkout -B fork-sync/v$new origin/fork/main
git rebase -i --onto v$new v$old    # drop the old "chore(fork): sync to upstream" commit
# fix conflicts, keep `fork:` markers, then: git add <files> && git rebase --continue
echo $new > fork/UPSTREAM_VERSION
git commit -am "chore(fork): sync to upstream v$new [skip ci]"
```

Common hot spots: `scripts/build-desktop-artifact.ts` (build config),
`apps/desktop/src/app/DesktopUserData.ts`, `apps/desktop/src/wsl/DesktopWslEnvironment.ts`, and
the desktop tests that assert identity values. Check upstream for new identity strings
(`t3code://`, `com.t3tools.t3code`, `~/.t3`, `t3code-v2`) and route them through
`forkIdentity.ts`:

```sh
git grep -nE 't3code(-dev)?://|com\.t3tools\.t3code|"\.t3"|\.t3/|t3code-v2' -- apps packages scripts ':!*.test.ts'
```

## 3. Verify

The same checks the sync job runs, for each package the fork touches (`apps/desktop`,
`apps/server`, `apps/web`, `packages/shared`, `scripts`):

```sh
vp install && vp run --filter @t3tools/desktop ensure:electron
(cd apps/desktop && vp run typecheck && vp test run)
(cd packages/shared && vp run typecheck && vp test run --config ../../vite.config.ts --dir .)
(cd scripts && vp run typecheck && vp test run --config ../vite.config.ts --dir . build-desktop-artifact fork-)
(cd apps/server && vp run typecheck)
(cd apps/web && vp run typecheck)
```

Do not run repo-wide checks (`vp check`, `vp run -r ...`).

## 4. Publish

```sh
git push --force-with-lease=fork/main:$(git rev-parse origin/fork/main) origin HEAD:fork/main
gh workflow run fork-release.yml -R adamhalama/t3code --ref fork/main -f publish=true
scripts/fork-disable-upstream-workflows.sh adamhalama/t3code
```

The push carries `[skip ci]`, so the release starts only from the dispatch. Close the
`fork-sync-failed` issue with a link to the release run. Check that the release
`vX.Y.Z-fork.1` is marked latest and has `latest.yml`, the `.exe`, and its `.blockmap`.
