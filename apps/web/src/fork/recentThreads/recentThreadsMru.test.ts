import { describe, expect, it } from "vite-plus/test";

import {
  pruneRecentThreads,
  readListCollapsed,
  readRecentThreadKeys,
  RECENT_THREADS_CAP,
  RECENT_THREADS_STORAGE_KEY,
  resolveRecentThreadList,
  touchRecentThread,
  writeListCollapsed,
  writeRecentThreadKeys,
  type RecentThreadCandidate,
} from "./recentThreadsMru";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
}

const live: RecentThreadCandidate = { archivedAt: null, deletedAt: null };
const archived: RecentThreadCandidate = { archivedAt: "2026-11-01T00:00:00.000Z", deletedAt: null };
const deleted: RecentThreadCandidate = { archivedAt: null, deletedAt: "2026-11-01T00:00:00.000Z" };

describe("touchRecentThread", () => {
  it("moves the opened thread to the front", () => {
    expect(touchRecentThread(["env:a", "env:b", "env:c"], "env:c")).toEqual([
      "env:c",
      "env:a",
      "env:b",
    ]);
  });

  it("adds a new thread at the front", () => {
    expect(touchRecentThread(["env:a"], "env:b")).toEqual(["env:b", "env:a"]);
  });

  it("keeps the same list when the thread is already first", () => {
    const keys = ["env:a", "env:b"];
    expect(touchRecentThread(keys, "env:a")).toBe(keys);
  });

  it("drops duplicates", () => {
    expect(touchRecentThread(["env:a", "env:b", "env:a", "env:b"], "env:b")).toEqual([
      "env:b",
      "env:a",
    ]);
  });

  it("caps the list, dropping the oldest", () => {
    const keys = Array.from({ length: RECENT_THREADS_CAP }, (_, index) => `env:t${index}`);
    const next = touchRecentThread(keys, "env:new");
    expect(next).toHaveLength(RECENT_THREADS_CAP);
    expect(next[0]).toBe("env:new");
    expect(next).not.toContain(`env:t${RECENT_THREADS_CAP - 1}`);
    expect(touchRecentThread(["env:a", "env:b", "env:c"], "env:d", 2)).toEqual(["env:d", "env:a"]);
  });

  it("keys threads by environment and thread id", () => {
    expect(touchRecentThread(["local:thread-1"], "remote:thread-1")).toEqual([
      "remote:thread-1",
      "local:thread-1",
    ]);
  });
});

describe("pruneRecentThreads", () => {
  it("removes deleted and archived threads but keeps ones not loaded yet", () => {
    const lookup = (key: string) =>
      ({ "env:a": live, "env:b": archived, "env:c": deleted })[key] ?? null;
    expect(pruneRecentThreads(["env:a", "env:b", "env:c", "env:d"], lookup)).toEqual([
      "env:a",
      "env:d",
    ]);
  });

  it("returns the same list when nothing is removed", () => {
    const keys = ["env:a"];
    expect(pruneRecentThreads(keys, () => live)).toBe(keys);
  });
});

describe("resolveRecentThreadList", () => {
  const lookup = (key: string) =>
    ({ "env:a": live, "env:b": live, "env:c": archived, "env:d": live })[key] ?? null;

  it("lists only threads that exist and are neither deleted nor archived", () => {
    expect(
      resolveRecentThreadList(["env:a", "env:c", "env:missing", "env:b"], null, lookup),
    ).toEqual(["env:a", "env:b"]);
  });

  it("puts the open thread first", () => {
    expect(resolveRecentThreadList(["env:a", "env:b"], "env:d", lookup)).toEqual([
      "env:d",
      "env:a",
      "env:b",
    ]);
    expect(resolveRecentThreadList(["env:a", "env:b"], "env:b", lookup)).toEqual([
      "env:b",
      "env:a",
    ]);
  });
});

describe("persistence", () => {
  it("round-trips the recent list", () => {
    const storage = memoryStorage();
    writeRecentThreadKeys(storage, ["env:a", "env:b"]);
    expect(readRecentThreadKeys(storage)).toEqual(["env:a", "env:b"]);
  });

  it("ignores malformed or foreign values", () => {
    expect(readRecentThreadKeys(memoryStorage({ [RECENT_THREADS_STORAGE_KEY]: "{" }))).toEqual([]);
    expect(readRecentThreadKeys(memoryStorage({ [RECENT_THREADS_STORAGE_KEY]: "{}" }))).toEqual([]);
    expect(
      readRecentThreadKeys(
        memoryStorage({
          [RECENT_THREADS_STORAGE_KEY]: JSON.stringify(["env:a", 4, "nokey", "env:a"]),
        }),
      ),
    ).toEqual(["env:a"]);
    expect(readRecentThreadKeys(null)).toEqual([]);
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readRecentThreadKeys(broken)).toEqual([]);
    expect(() => writeRecentThreadKeys(broken, ["env:a"])).not.toThrow();
    expect(readListCollapsed(broken)).toBe(false);
  });

  it("remembers whether the list is folded", () => {
    const storage = memoryStorage();
    expect(readListCollapsed(storage)).toBe(false);
    writeListCollapsed(storage, true);
    expect(readListCollapsed(storage)).toBe(true);
    writeListCollapsed(storage, false);
    expect(readListCollapsed(storage)).toBe(false);
  });
});
