#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - Fork-owned CLI stays plain Node so it survives upstream Effect API changes.
// fork: release versions are <upstream>-fork.<n> (fork/README.md#versioning). No workspace imports,
// so CI and fresh clones run it before `vp install`.
//   node scripts/fork-version.ts next --upstream 0.1.7 < tags.txt   -> 0.1.7-fork.<n+1>
//   node scripts/fork-version.ts latest-upstream < releases.jsonl   -> newest stable X.Y.Z
import * as NodeFS from "node:fs";

const STABLE_VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Same contract as parseForkVersion in @t3tools/shared/forkIdentity (asserted in the test). */
export function parseForkReleaseVersion(
  value: string,
): { readonly upstream: string; readonly n: number } | null {
  const match = /^v?(\d+\.\d+\.\d+)-fork\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return { upstream: match[1]!, n: Number(match[2]) };
}

export function parseStableVersion(value: string): readonly [number, number, number] | null {
  const match = STABLE_VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareStableVersions(left: string, right: string): number {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  if (!a || !b) throw new Error(`Not a stable X.Y.Z version: ${a ? right : left}`);
  for (let index = 0; index < 3; index += 1) {
    const delta = a[index]! - b[index]!;
    if (delta !== 0) return delta;
  }
  return 0;
}

/** The next `<upstream>-fork.<n>`: one past the highest `n` already used for this upstream version. */
export function nextForkVersion(upstreamVersion: string, existing: ReadonlyArray<string>): string {
  if (!parseStableVersion(upstreamVersion)) {
    throw new Error(`Upstream version must be X.Y.Z, got '${upstreamVersion}'.`);
  }
  const upstream = upstreamVersion.trim().replace(/^v/, "");
  let highest = 0;
  for (const entry of existing) {
    const parsed = parseForkReleaseVersion(entry);
    if (parsed && parsed.upstream === upstream) highest = Math.max(highest, parsed.n);
  }
  return `${upstream}-fork.${highest + 1}`;
}

export interface UpstreamRelease {
  readonly tag_name: string;
  readonly draft?: boolean;
  readonly prerelease?: boolean;
}

/** Newest published, non-prerelease `vX.Y.Z` release, without the `v`. */
export function latestStableUpstreamVersion(
  releases: ReadonlyArray<UpstreamRelease>,
): string | null {
  let latest: string | null = null;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (!parseStableVersion(release.tag_name)) continue;
    const version = release.tag_name.replace(/^v/, "");
    if (latest === null || compareStableVersions(version, latest) > 0) latest = version;
  }
  return latest;
}

/** A JSON array, or one JSON object per line (`gh api --paginate --jq '.[]'`). */
export function parseReleaseList(raw: string): UpstreamRelease[] {
  const text = raw.trim();
  if (text === "") return [];
  if (text.startsWith("[")) return JSON.parse(text) as UpstreamRelease[];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as UpstreamRelease);
}

function readStdin(): string {
  return NodeFS.readFileSync(0, "utf8");
}

function main(argv: ReadonlyArray<string>): number {
  const [command, ...rest] = argv;
  if (command === "next") {
    const flag = rest.indexOf("--upstream");
    const upstream = flag === -1 ? undefined : rest[flag + 1];
    if (!upstream) {
      process.stderr.write("usage: fork-version.ts next --upstream X.Y.Z < tags.txt\n");
      return 2;
    }
    process.stdout.write(`${nextForkVersion(upstream, readStdin().split(/\r?\n/))}\n`);
    return 0;
  }
  if (command === "latest-upstream") {
    const latest = latestStableUpstreamVersion(parseReleaseList(readStdin()));
    if (!latest) {
      process.stderr.write("No stable upstream release found.\n");
      return 1;
    }
    process.stdout.write(`${latest}\n`);
    return 0;
  }
  process.stderr.write("usage: fork-version.ts <next|latest-upstream> ...\n");
  return 2;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
