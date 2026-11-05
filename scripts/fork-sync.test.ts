// fork: pure parts of the upstream sync (fork/UPDATE.md).
import { assert, it } from "@effect/vitest";

import {
  dropCommitsFromTodo,
  failureReport,
  isSyncCommitSubject,
  relatedTestArgs,
  SyncFailure,
  syncCommitMessage,
  touchedPackageDirs,
} from "./fork-sync.ts";

it("marks sync commits so the next sync drops them and fork-release skips the push", () => {
  const message = syncCommitMessage("0.1.8");
  assert.equal(message, "chore(fork): sync to upstream v0.1.8 [skip ci]");
  assert.isTrue(isSyncCommitSubject(message));
  assert.isFalse(isSyncCommitSubject("feat(fork): identity"));
});

it("drops only the listed commits from a rebase todo", () => {
  const todo = [
    "pick 1111111 feat(fork): identity",
    "pick 2222222 chore(fork): sync to upstream v0.1.8 [skip ci]",
    "pick 3333333 # feat(fork): workflows",
    "",
    "# Rebase abc..def onto 123",
  ].join("\n");
  const edited = dropCommitsFromTodo(todo, ["2222222aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
  assert.deepStrictEqual(edited.split("\n").slice(0, 3), [
    "pick 1111111 feat(fork): identity",
    "drop 2222222 chore(fork): sync to upstream v0.1.8 [skip ci]",
    "pick 3333333 # feat(fork): workflows",
  ]);
});

it("maps changed files to their nearest workspace package", () => {
  const packages = new Set(["apps/desktop", "packages/shared", "scripts"]);
  const touched = touchedPackageDirs(
    [
      "apps/desktop/src/app/DesktopUserData.ts",
      "packages/shared/src/forkIdentity.ts",
      "scripts/fork-sync.ts",
      "fork/README.md",
      ".github/workflows/fork-sync.yml",
      "AGENTS.md",
    ],
    (dir) => packages.has(dir),
  );
  assert.deepStrictEqual(Object.fromEntries(touched), {
    "apps/desktop": ["src/app/DesktopUserData.ts"],
    "packages/shared": ["src/forkIdentity.ts"],
    scripts: ["fork-sync.ts"],
  });
});

it("runs related tests with the package's own test options, minus browser projects", () => {
  assert.deepStrictEqual(
    relatedTestArgs("vp test run --config ../../vite.config.ts --dir .", [
      "src/a.ts",
      "package.json",
    ]),
    [
      "test",
      "related",
      "--run",
      "--passWithNoTests",
      "--config",
      "../../vite.config.ts",
      "--dir",
      ".",
      "src/a.ts",
    ],
  );
  assert.deepStrictEqual(
    relatedTestArgs("vp test run --passWithNoTests --project unit --project browser", [
      "src/b.tsx",
    ]),
    ["test", "related", "--run", "--passWithNoTests", "--project", "unit", "src/b.tsx"],
  );
  assert.isNull(relatedTestArgs("vp test run", ["README.md"]));
  assert.isNull(relatedTestArgs("node --test", ["src/a.ts"]));
  assert.isNull(relatedTestArgs(undefined, ["src/a.ts"]));
});

it("reports the failing step, conflicts, and a repro command", () => {
  const report = failureReport(
    new SyncFailure("rebase", "Fork commits do not apply cleanly onto upstream v0.1.8.", {
      conflictingFiles: ["scripts/build-desktop-artifact.ts"],
      commit: "abc1234 feat(fork): identity",
    }),
    { from: "0.1.7", to: "0.1.8", runUrl: "https://github.com/adamhalama/t3code/actions/runs/1" },
    { upstreamRepo: "pingdotgg/t3code" },
  );
  assert.include(report, "failed at **rebase**");
  assert.include(report, "- `scripts/build-desktop-artifact.ts`");
  assert.include(report, "abc1234 feat(fork): identity");
  assert.include(report, "node scripts/fork-sync.ts --dry-run --upstream-version 0.1.8");
  assert.include(report, "https://github.com/adamhalama/t3code/actions/runs/1");
});
