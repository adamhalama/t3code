// fork: release versioning and upstream selection (fork/README.md#versioning).
import { assert, it } from "@effect/vitest";
import { parseForkVersion } from "@t3tools/shared/forkIdentity";

import {
  compareStableVersions,
  latestStableUpstreamVersion,
  nextForkVersion,
  parseForkReleaseVersion,
  parseReleaseList,
} from "./fork-version.ts";

it("starts each upstream version at -fork.1", () => {
  assert.equal(nextForkVersion("0.1.8", ["v0.1.7-fork.1", "v0.1.7-fork.2"]), "0.1.8-fork.1");
  assert.equal(nextForkVersion("v0.1.8", []), "0.1.8-fork.1");
});

it("counts past the highest existing -fork.N for the same upstream version", () => {
  assert.equal(
    nextForkVersion("0.1.7", [
      "v0.1.7-fork.1",
      "v0.1.7-fork.10",
      "0.1.7-fork.3",
      "v0.1.7",
      "junk",
      "",
    ]),
    "0.1.7-fork.11",
  );
});

it("rejects a non-stable upstream version", () => {
  assert.throws(() => nextForkVersion("0.1.8-nightly.20260101.1", []));
});

it("orders stable versions numerically", () => {
  assert.isAbove(compareStableVersions("0.1.10", "0.1.9"), 0);
  assert.isBelow(compareStableVersions("v0.9.0", "1.0.0"), 0);
  assert.equal(compareStableVersions("1.2.3", "v1.2.3"), 0);
});

it("picks the newest published stable upstream release", () => {
  const releases = parseReleaseList(
    [
      '{"tag_name":"v0.1.9","draft":true,"prerelease":false}',
      '{"tag_name":"v0.1.8-nightly.20260101.1","draft":false,"prerelease":true}',
      '{"tag_name":"v0.1.10","draft":false,"prerelease":true}',
      '{"tag_name":"v0.1.8","draft":false,"prerelease":false}',
      '{"tag_name":"v0.1.7","draft":false,"prerelease":false}',
    ].join("\n"),
  );
  assert.equal(latestStableUpstreamVersion(releases), "0.1.8");
  assert.equal(latestStableUpstreamVersion(parseReleaseList('[{"tag_name":"v2.0.0"}]')), "2.0.0");
  assert.equal(latestStableUpstreamVersion(parseReleaseList("")), null);
});

it("parses fork versions exactly like the shared forkIdentity helper", () => {
  for (const value of ["0.1.7-fork.1", "10.20.30-fork.42", "0.1.7", "0.1.7-fork", "0.1.7-fork.x"]) {
    assert.deepStrictEqual(parseForkReleaseVersion(value), parseForkVersion(value));
  }
  assert.deepStrictEqual(parseForkReleaseVersion("v0.1.7-fork.2"), { upstream: "0.1.7", n: 2 });
});
