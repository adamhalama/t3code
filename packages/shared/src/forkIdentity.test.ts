// fork: version and update-channel rules for `<upstream>-fork.<n>` releases.
import { describe, expect, it } from "vite-plus/test";

import { cliReleaseChannelOf, desktopUpdateChannelOf } from "./cliRelease.ts";
import { forkDesktopDisplayName, isForkVersion, parseForkVersion } from "./forkIdentity.ts";
import { compareSemverVersions } from "./semver.ts";

describe("forkIdentity", () => {
  it("parses fork versions and rejects everything else", () => {
    expect(parseForkVersion("0.1.7-fork.1")).toEqual({ upstream: "0.1.7", n: 1 });
    expect(parseForkVersion("10.20.30-fork.42")).toEqual({ upstream: "10.20.30", n: 42 });
    expect(isForkVersion("0.1.7")).toBe(false);
    expect(isForkVersion("0.1.7-fork")).toBe(false);
    expect(isForkVersion("0.1.7-fork.1.2")).toBe(false);
    expect(isForkVersion("0.1.7-nightly.20260101.1")).toBe(false);
    expect(isForkVersion("v0.1.7-fork.1")).toBe(false);
  });

  it("orders fork versions so each release is newer than the last", () => {
    expect(compareSemverVersions("0.1.7-fork.2", "0.1.7-fork.1")).toBeGreaterThan(0);
    expect(compareSemverVersions("0.1.7-fork.10", "0.1.7-fork.9")).toBeGreaterThan(0);
    expect(compareSemverVersions("0.1.8-fork.1", "0.1.7-fork.9")).toBeGreaterThan(0);
    expect(compareSemverVersions("0.2.0-fork.1", "0.1.12-fork.3")).toBeGreaterThan(0);
  });

  it("treats fork versions as the stable track, not nightly", () => {
    expect(cliReleaseChannelOf("0.1.7-fork.1")).toBe("stable");
    expect(desktopUpdateChannelOf("0.1.7-fork.1")).toBe("latest");
  });

  it("names windows after the fork", () => {
    expect(forkDesktopDisplayName("T3 Code", "Beta")).toBe("T3 Code (Fork)");
    expect(forkDesktopDisplayName("T3 Code", "Dev")).toBe("T3 Code (Fork Dev)");
    expect(forkDesktopDisplayName("T3 Code", "Nightly")).toBe("T3 Code (Fork Nightly)");
  });
});
