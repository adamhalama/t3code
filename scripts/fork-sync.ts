#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - Fork-owned sync script stays plain Node so it survives upstream Effect API changes.
// fork: rebases fork/main onto the newest upstream stable release and pushes only if install,
// typecheck, and related tests pass. Usage and recovery: fork/UPDATE.md.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  compareStableVersions,
  latestStableUpstreamVersion,
  parseReleaseList,
  parseStableVersion,
} from "./fork-version.ts";

export const UPSTREAM_VERSION_FILE = "fork/UPSTREAM_VERSION";
export const SYNC_COMMIT_PREFIX = "chore(fork): sync to upstream v";

export interface SyncOptions {
  readonly dryRun: boolean;
  readonly skipChecks: boolean;
  readonly upstreamVersion: string | undefined;
  readonly forkRemote: string;
  readonly upstreamRemote: string;
  readonly upstreamRepo: string;
  readonly branch: string;
  readonly vp: string;
  readonly report: string | undefined;
  readonly repoDir: string;
}

export type SyncStep =
  | "resolve-upstream"
  | "read-fork-state"
  | "fetch"
  | "rebase"
  | "commit"
  | "install"
  | "typecheck"
  | "test"
  | "push";

export interface SyncFailureDetails {
  readonly conflictingFiles?: ReadonlyArray<string>;
  readonly commit?: string;
  readonly command?: string;
  readonly output?: string;
}

export class SyncFailure extends Error {
  readonly step: SyncStep;
  readonly details: SyncFailureDetails;

  constructor(step: SyncStep, message: string, details: SyncFailureDetails = {}) {
    super(message);
    this.step = step;
    this.details = details;
  }
}

export function syncCommitMessage(upstreamVersion: string): string {
  // [skip ci] keeps the push from starting fork-release.yml a second time; fork-sync.yml calls it.
  return `${SYNC_COMMIT_PREFIX}${upstreamVersion} [skip ci]`;
}

export function isSyncCommitSubject(subject: string): boolean {
  return subject.startsWith(SYNC_COMMIT_PREFIX);
}

/** Rewrites a `git rebase -i` todo list so the given commits are dropped. */
export function dropCommitsFromTodo(todo: string, dropShas: ReadonlyArray<string>): string {
  return todo
    .split("\n")
    .map((line) => {
      const match = /^(?:pick|p)\s+([0-9a-f]{4,40})\b/.exec(line);
      if (match && dropShas.some((sha) => sha.startsWith(match[1]!))) {
        return line.replace(/^(?:pick|p)\b/, "drop");
      }
      return line;
    })
    .join("\n");
}

/** Workspace package directories (with a package.json) that contain any of the files. */
export function touchedPackageDirs(
  files: ReadonlyArray<string>,
  hasPackageJson: (dir: string) => boolean,
): Map<string, string[]> {
  const packages = new Map<string, string[]>();
  for (const file of files) {
    const segments = file.split("/");
    for (let depth = segments.length - 1; depth >= 1; depth -= 1) {
      const dir = segments.slice(0, depth).join("/");
      if (dir.startsWith(".") || !hasPackageJson(dir)) continue;
      const list = packages.get(dir) ?? [];
      list.push(segments.slice(depth).join("/"));
      packages.set(dir, list);
      break;
    }
  }
  return packages;
}

/**
 * `vp test related` arguments that reuse the package's own `vp test run ...` test script options
 * (config, dir, projects) for only the tests related to the given files. Browser projects need a
 * Chromium install, so they are left to upstream CI.
 */
export function relatedTestArgs(
  testScript: string | undefined,
  files: ReadonlyArray<string>,
): string[] | null {
  const sourceFiles = files.filter((file) => /\.(?:[cm]?ts|tsx)$/.test(file));
  if (!testScript || sourceFiles.length === 0) return null;
  const tokens = testScript.trim().split(/\s+/);
  if (tokens[0] !== "vp" || tokens[1] !== "test" || tokens[2] !== "run") return null;
  const kept: string[] = [];
  for (let index = 3; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token === "--config" || token === "--dir") {
      kept.push(token, tokens[index + 1]!);
      index += 1;
    } else if (token === "--project") {
      const project = tokens[index + 1]!;
      if (project !== "browser") kept.push(token, project);
      index += 1;
    }
  }
  return ["test", "related", "--run", "--passWithNoTests", ...kept, ...sourceFiles];
}

export function reproCommand(options: Pick<SyncOptions, "upstreamRepo">, version: string): string {
  return [
    "git clone https://github.com/adamhalama/t3code.git t3code-sync && cd t3code-sync",
    `git remote add upstream https://github.com/${options.upstreamRepo}.git`,
    "vp install",
    `node scripts/fork-sync.ts --dry-run --upstream-version ${version}`,
  ].join("\n");
}

export function failureReport(
  failure: SyncFailure,
  context: { readonly from: string; readonly to: string; readonly runUrl?: string | undefined },
  options: Pick<SyncOptions, "upstreamRepo">,
): string {
  const lines = [
    `Syncing fork/main from upstream v${context.from} to v${context.to} failed at **${failure.step}**.`,
    "",
    failure.message,
  ];
  if (context.runUrl) lines.push("", `Run: ${context.runUrl}`);
  if (failure.details.commit)
    lines.push("", `Fork commit being applied: \`${failure.details.commit}\``);
  if (failure.details.conflictingFiles?.length) {
    lines.push(
      "",
      "Conflicting files:",
      ...failure.details.conflictingFiles.map((file) => `- \`${file}\``),
    );
  }
  if (failure.details.command) lines.push("", `Failing command: \`${failure.details.command}\``);
  if (failure.details.output) {
    lines.push(
      "",
      "<details><summary>Output (tail)</summary>",
      "",
      "```",
      failure.details.output,
      "```",
      "</details>",
    );
  }
  lines.push(
    "",
    "Reproduce locally (nothing is pushed with --dry-run):",
    "",
    "```sh",
    reproCommand(options, context.to),
    "```",
    "",
    "Then follow fork/UPDATE.md. Nothing was pushed; fork/main is unchanged.",
  );
  return `${lines.join("\n")}\n`;
}

function tail(text: string, lines = 60): string {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

interface RunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(
  command: string,
  args: ReadonlyArray<string>,
  options: NodeChildProcess.SpawnSyncOptions & { readonly cwd: string },
): RunResult {
  const result = NodeChildProcess.spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
}

function log(message: string): void {
  process.stdout.write(`[fork-sync] ${message}\n`);
}

function setOutput(name: string, value: string): void {
  const path = process.env.GITHUB_OUTPUT;
  if (path) NodeFS.appendFileSync(path, `${name}=${value}\n`);
}

class Git {
  readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  run(args: ReadonlyArray<string>, step: SyncStep, env?: NodeJS.ProcessEnv): string {
    const result = run("git", args, {
      cwd: this.cwd,
      env: env ? { ...process.env, ...env } : process.env,
    });
    if (result.status !== 0) {
      throw new SyncFailure(step, `git ${args.join(" ")} exited with ${result.status}.`, {
        command: `git ${args.join(" ")}`,
        output: tail(`${result.stdout}${result.stderr}`),
      });
    }
    return result.stdout;
  }

  tryRun(args: ReadonlyArray<string>, env?: NodeJS.ProcessEnv): RunResult {
    return run("git", args, { cwd: this.cwd, env: env ? { ...process.env, ...env } : process.env });
  }
}

function resolveTargetVersion(options: SyncOptions): string {
  if (options.upstreamVersion) {
    const version = options.upstreamVersion.replace(/^v/, "");
    if (!parseStableVersion(version)) {
      throw new SyncFailure(
        "resolve-upstream",
        `--upstream-version must be X.Y.Z, got '${options.upstreamVersion}'.`,
      );
    }
    return version;
  }
  const result = run(
    "gh",
    [
      "api",
      "--paginate",
      `repos/${options.upstreamRepo}/releases`,
      "--jq",
      ".[] | {tag_name, draft, prerelease}",
    ],
    { cwd: options.repoDir },
  );
  if (result.status !== 0) {
    throw new SyncFailure("resolve-upstream", `Could not list ${options.upstreamRepo} releases.`, {
      command: `gh api repos/${options.upstreamRepo}/releases`,
      output: tail(result.stderr),
    });
  }
  const latest = latestStableUpstreamVersion(parseReleaseList(result.stdout));
  if (!latest)
    throw new SyncFailure(
      "resolve-upstream",
      `No stable release found in ${options.upstreamRepo}.`,
    );
  return latest;
}

function runCheck(step: SyncStep, command: string, args: ReadonlyArray<string>, cwd: string): void {
  const label = `${command} ${args.join(" ")}`;
  log(`${step}: ${label} (in ${cwd})`);
  const result = run(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new SyncFailure(
      step,
      `\`${label}\` failed in ${cwd} with exit code ${result.status}. See the run log.`,
      {
        command: `cd ${cwd} && ${label}`,
      },
    );
  }
}

export interface SyncProgress {
  from?: string;
  to?: string;
}

export function sync(options: SyncOptions, progress: SyncProgress = {}): "up-to-date" | "synced" {
  const git = new Git(options.repoDir);
  const forkRef = `refs/remotes/${options.forkRemote}/${options.branch}`;

  log(`fetching ${options.forkRemote}/${options.branch}`);
  git.run(
    ["fetch", "--no-tags", options.forkRemote, `+refs/heads/${options.branch}:${forkRef}`],
    "fetch",
  );
  const forkSha = git.run(["rev-parse", forkRef], "read-fork-state").trim();

  const shown = git.tryRun(["show", `${forkSha}:${UPSTREAM_VERSION_FILE}`]);
  const current = shown.stdout.trim();
  if (shown.status !== 0 || !parseStableVersion(current)) {
    throw new SyncFailure(
      "read-fork-state",
      `${options.branch} has no valid ${UPSTREAM_VERSION_FILE} (got '${current}').`,
    );
  }
  progress.from = current;
  const target = resolveTargetVersion(options);
  progress.to = target;
  setOutput("previous_version", current);
  setOutput("upstream_version", target);
  log(`fork is on upstream v${current}; newest target is v${target}`);

  const order = compareStableVersions(target, current);
  if (order === 0) {
    log("already up to date");
    return "up-to-date";
  }
  if (order < 0) {
    if (!options.upstreamVersion) return "up-to-date";
    throw new SyncFailure(
      "resolve-upstream",
      `Refusing to move ${options.branch} back from v${current} to v${target}.`,
    );
  }

  if (git.run(["status", "--porcelain", "--untracked-files=no"], "rebase").trim() !== "") {
    throw new SyncFailure("rebase", `Working tree in ${options.repoDir} has uncommitted changes.`);
  }

  log(`fetching upstream tags v${current} and v${target}`);
  git.run(
    [
      "fetch",
      "--no-tags",
      options.upstreamRemote,
      `+refs/tags/v${current}:refs/tags/v${current}`,
      `+refs/tags/v${target}:refs/tags/v${target}`,
    ],
    "fetch",
  );
  if (git.tryRun(["merge-base", "--is-ancestor", `v${current}`, forkSha]).status !== 0) {
    throw new SyncFailure(
      "rebase",
      `${options.branch} does not contain upstream v${current}; fix ${UPSTREAM_VERSION_FILE} first.`,
    );
  }

  const commits = git
    .run(
      ["log", "--reverse", "--no-merges", "--format=%H%x09%s", `v${current}..${forkSha}`],
      "rebase",
    )
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [sha = "", ...subject] = line.split("\t");
      return { sha, subject: subject.join("\t") };
    });
  const dropShas = commits
    .filter((commit) => isSyncCommitSubject(commit.subject))
    .map((commit) => commit.sha);
  log(
    `rebasing ${commits.length - dropShas.length} fork commit(s) onto v${target} (dropping ${dropShas.length} sync commit(s))`,
  );

  const originalHead =
    git.tryRun(["symbolic-ref", "--short", "-q", "HEAD"]).stdout.trim() ||
    git.run(["rev-parse", "HEAD"], "rebase").trim();
  const workBranch = `fork-sync/v${target}`;
  git.run(["checkout", "-q", "-B", workBranch, forkSha], "rebase");

  const editor = `${JSON.stringify(process.execPath)} ${JSON.stringify(NodePath.resolve(import.meta.filename))} --rebase-todo-editor`;
  const rebase = git.tryRun(
    ["rebase", "-i", "--empty=drop", "--onto", `v${target}`, `v${current}`],
    {
      GIT_SEQUENCE_EDITOR: editor,
      FORK_SYNC_DROP: dropShas.join(" "),
    },
  );
  if (rebase.status !== 0) {
    const conflictingFiles = git
      .tryRun(["diff", "--name-only", "--diff-filter=U"])
      .stdout.split("\n")
      .filter((file) => file !== "");
    const stopped = git.tryRun(["log", "-1", "--format=%h %s", "REBASE_HEAD"]).stdout.trim();
    git.tryRun(["rebase", "--abort"]);
    git.tryRun(["checkout", "-q", originalHead]);
    throw new SyncFailure("rebase", `Fork commits do not apply cleanly onto upstream v${target}.`, {
      conflictingFiles,
      ...(stopped ? { commit: stopped } : {}),
      output: tail(`${rebase.stdout}${rebase.stderr}`, 30),
    });
  }

  NodeFS.writeFileSync(NodePath.join(options.repoDir, UPSTREAM_VERSION_FILE), `${target}\n`);
  git.run(["add", UPSTREAM_VERSION_FILE], "commit");
  git.run(["commit", "-q", "-m", syncCommitMessage(target)], "commit");
  const newSha = git.run(["rev-parse", "HEAD"], "commit").trim();
  log(
    `rebased ${options.branch}: ${forkSha.slice(0, 10)} -> ${newSha.slice(0, 10)} on ${workBranch}`,
  );

  try {
    if (options.skipChecks) {
      log("skipping install, typecheck, and tests (--skip-checks)");
    } else {
      runCheck("install", options.vp, ["install"], options.repoDir);
      // The synced tree's own vp, so its tests load the Vitest that this tree installed.
      const localVp = NodePath.join(options.repoDir, "node_modules", ".bin", "vp");
      const vp = NodeFS.existsSync(localVp) ? localVp : options.vp;
      const changed = git
        .run(["diff", "--name-only", `v${target}`, "HEAD"], "typecheck")
        .split("\n")
        .filter((file) => file !== "");
      const packages = touchedPackageDirs(changed, (dir) =>
        NodeFS.existsSync(NodePath.join(options.repoDir, dir, "package.json")),
      );
      log(`fork touches packages: ${[...packages.keys()].join(", ") || "(none)"}`);
      const scriptsOf = (dir: string): Record<string, string> =>
        (
          JSON.parse(
            NodeFS.readFileSync(NodePath.join(options.repoDir, dir, "package.json"), "utf8"),
          ) as { scripts?: Record<string, string> }
        ).scripts ?? {};
      for (const dir of packages.keys()) {
        // Electron 44 has no install script; its tests need the binary (as in ci.yml).
        if (scriptsOf(dir)["ensure:electron"]) {
          runCheck("install", vp, ["run", "ensure:electron"], NodePath.join(options.repoDir, dir));
        }
      }
      for (const dir of packages.keys()) {
        runCheck("typecheck", vp, ["run", "typecheck"], NodePath.join(options.repoDir, dir));
      }
      for (const [dir, files] of packages) {
        const args = relatedTestArgs(scriptsOf(dir).test, files);
        if (args) runCheck("test", vp, args, NodePath.join(options.repoDir, dir));
      }
    }

    const pushArgs = [
      "push",
      `--force-with-lease=refs/heads/${options.branch}:${forkSha}`,
      options.forkRemote,
      `HEAD:refs/heads/${options.branch}`,
    ];
    if (options.dryRun) {
      log(`dry run: would run git ${pushArgs.join(" ")}`);
    } else {
      git.run(pushArgs, "push");
      log(`pushed ${options.branch} at upstream v${target}`);
    }
  } finally {
    git.tryRun(["checkout", "-q", originalHead]);
  }
  setOutput("sha", newSha);
  return "synced";
}

function parseArgs(argv: ReadonlyArray<string>): SyncOptions {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    dryRun: argv.includes("--dry-run"),
    skipChecks: argv.includes("--skip-checks"),
    upstreamVersion: value("--upstream-version"),
    forkRemote: value("--fork-remote") ?? "origin",
    upstreamRemote: value("--upstream-remote") ?? "upstream",
    upstreamRepo: value("--upstream-repo") ?? "pingdotgg/t3code",
    branch: value("--branch") ?? "fork/main",
    vp: value("--vp") ?? process.env.FORK_SYNC_VP ?? "vp",
    report: value("--report"),
    repoDir: NodePath.resolve(value("--repo-dir") ?? process.cwd()),
  };
}

function main(argv: ReadonlyArray<string>): number {
  const editorIndex = argv.indexOf("--rebase-todo-editor");
  if (editorIndex !== -1) {
    const todoPath = argv[editorIndex + 1]!;
    const drop = (process.env.FORK_SYNC_DROP ?? "").split(" ").filter((sha) => sha !== "");
    NodeFS.writeFileSync(
      todoPath,
      dropCommitsFromTodo(NodeFS.readFileSync(todoPath, "utf8"), drop),
    );
    return 0;
  }

  const options = parseArgs(argv);
  const progress: SyncProgress = {};
  try {
    const status = sync(options, progress);
    setOutput("status", status);
    return 0;
  } catch (error) {
    const failure =
      error instanceof SyncFailure
        ? error
        : new SyncFailure(
            "resolve-upstream",
            error instanceof Error ? error.message : String(error),
          );
    setOutput("status", "failed");
    setOutput("failed_step", failure.step);
    const runUrl = process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;
    const report = failureReport(
      failure,
      {
        from: progress.from ?? "?",
        to: progress.to ?? options.upstreamVersion?.replace(/^v/, "") ?? "?",
        runUrl,
      },
      options,
    );
    if (options.report) NodeFS.writeFileSync(options.report, report);
    process.stderr.write(`[fork-sync] FAILED at ${failure.step}: ${failure.message}\n`);
    if (failure.details.output) process.stderr.write(`${failure.details.output}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
