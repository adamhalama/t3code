import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES,
  expireRecentThreads,
  readListCollapsed,
  readTimeoutMinutes,
  RECENT_THREADS_CAP,
  reconcileRecentThreadEntries,
  recordRecentThreadVisit,
  resolveRecentThreadList,
  writeListCollapsed,
  writeTimeoutMinutes,
  type RecentThreadCandidate,
  type RecentThreadEntry,
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

const entries = (...items: Array<[string, number]>): RecentThreadEntry[] =>
  items.map(([key, at]) => ({ key, at }));

const live: RecentThreadCandidate = { archivedAt: null, deletedAt: null };
const archived: RecentThreadCandidate = { archivedAt: "2026-11-01T00:00:00.000Z", deletedAt: null };

const anyLive = () => live;

const MINUTE = 60_000;

describe("recordRecentThreadVisit", () => {
  it("moves the opened thread to the front and stamps the one left", () => {
    expect(
      recordRecentThreadVisit(
        entries(["env:a", 1], ["env:b", 2], ["env:c", 3]),
        "env:a",
        "env:c",
        9,
      ),
    ).toEqual(entries(["env:c", 9], ["env:a", 9], ["env:b", 2]));
  });

  it("stamps the thread left for a page that is not a thread, in place", () => {
    expect(recordRecentThreadVisit(entries(["env:a", 1], ["env:b", 2]), "env:a", null, 9)).toEqual(
      entries(["env:a", 9], ["env:b", 2]),
    );
  });

  it("adds a new thread at the front", () => {
    expect(recordRecentThreadVisit(entries(["env:a", 1]), null, ":draft:b", 9)).toEqual(
      entries([":draft:b", 9], ["env:a", 1]),
    );
  });

  it("caps the list, dropping the oldest", () => {
    const full = Array.from({ length: RECENT_THREADS_CAP }, (_, index) => ({
      key: `env:t${index}`,
      at: index,
    }));
    const next = recordRecentThreadVisit(full, "env:t0", "env:new", 99);
    expect(next).toHaveLength(RECENT_THREADS_CAP);
    expect(next[0]).toEqual({ key: "env:new", at: 99 });
    expect(next.map((entry) => entry.key)).not.toContain(`env:t${RECENT_THREADS_CAP - 1}`);
  });
});

describe("reconcileRecentThreadEntries", () => {
  it("preserves a draft's position and time when its destination is already listed", () => {
    const list = entries(["env:b", 10], ["env:a", 8], [":draft:b", 5], ["env:c", 2]);
    const promoted = (key: string) => (key === ":draft:b" ? "env:b" : key);
    expect(reconcileRecentThreadEntries(list, promoted)).toEqual(
      entries(["env:a", 8], ["env:b", 5], ["env:c", 2]),
    );
  });
});

describe("expireRecentThreads", () => {
  const now = 100 * MINUTE;
  const timeout = 30 * MINUTE;

  it("drops threads left longer ago than the timeout, keeping the exact boundary", () => {
    const list = entries(
      ["env:current", 0],
      ["env:previous", now - 5 * MINUTE],
      ["env:boundary", now - timeout],
      [":draft:old", now - timeout - 1],
    );
    expect(expireRecentThreads(list, "env:current", now, timeout, anyLive)).toEqual(
      entries(
        ["env:current", 0],
        ["env:previous", now - 5 * MINUTE],
        ["env:boundary", now - timeout],
      ),
    );
  });

  it("always keeps the open thread and the one before it", () => {
    const list = entries(["env:current", 0], [":draft:previous", 0], ["env:older", 0]);
    expect(expireRecentThreads(list, "env:current", now, timeout, anyLive)).toEqual(
      entries(["env:current", 0], [":draft:previous", 0]),
    );
    expect(expireRecentThreads(list, null, now, timeout, anyLive)).toEqual(
      entries(["env:current", 0]),
    );
  });

  it("keeps the switchable thread before the open one, dropping archived ones", () => {
    const list = entries(
      ["env:current", 0],
      ["env:archived", 0],
      ["env:unknown", 0],
      ["env:live", 0],
    );
    const lookup = (key: string) =>
      ({ "env:current": live, "env:archived": archived, "env:live": live })[key] ?? null;
    expect(expireRecentThreads(list, "env:current", now, timeout, lookup)).toEqual(
      entries(["env:current", 0], ["env:live", 0]),
    );
    expect(expireRecentThreads(list, "env:current", now, 0, lookup)).toEqual(
      entries(["env:current", 0], ["env:unknown", 0], ["env:live", 0]),
    );
  });

  it("keeps everything when the timeout is off", () => {
    const list = entries(["env:a", 0], ["env:b", 0], ["env:c", 0]);
    expect(expireRecentThreads(list, "env:a", now, 0, anyLive)).toBe(list);
  });

  it("treats a time in the future as just now", () => {
    const list = entries(["env:a", now], ["env:b", now], ["env:c", now + 60 * MINUTE]);
    expect(expireRecentThreads(list, "env:a", now, timeout, anyLive)).toBe(list);
  });
});

describe("resolveRecentThreadList", () => {
  const lookup = (key: string) =>
    ({ "env:a": live, "env:b": live, "env:c": archived, "env:d": live })[key] ?? null;

  it("lists only threads that exist and are neither deleted nor archived", () => {
    expect(
      resolveRecentThreadList(
        entries(["env:a", 0], ["env:c", 0], ["env:missing", 0], ["env:b", 0]),
        null,
        lookup,
      ),
    ).toEqual(["env:a", "env:b"]);
  });

  it("puts the open thread first", () => {
    expect(resolveRecentThreadList(entries(["env:a", 0], ["env:b", 0]), "env:d", lookup)).toEqual([
      "env:d",
      "env:a",
      "env:b",
    ]);
    expect(resolveRecentThreadList(entries(["env:a", 0], ["env:b", 0]), "env:b", lookup)).toEqual([
      "env:b",
      "env:a",
    ]);
  });
});

describe("persistence", () => {
  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readListCollapsed(broken)).toBe(false);
    expect(readTimeoutMinutes(broken)).toBe(DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES);
    expect(() => writeTimeoutMinutes(broken, 15)).not.toThrow();
  });

  it("remembers whether the list is folded", () => {
    const storage = memoryStorage();
    expect(readListCollapsed(storage)).toBe(false);
    writeListCollapsed(storage, true);
    expect(readListCollapsed(storage)).toBe(true);
    writeListCollapsed(storage, false);
    expect(readListCollapsed(storage)).toBe(false);
  });

  it("remembers the timeout, defaulting to 30 minutes", () => {
    const storage = memoryStorage();
    expect(readTimeoutMinutes(storage)).toBe(30);
    writeTimeoutMinutes(storage, 0);
    expect(readTimeoutMinutes(storage)).toBe(0);
    writeTimeoutMinutes(storage, 120);
    expect(readTimeoutMinutes(storage)).toBe(120);
    const stored = (value: string) =>
      memoryStorage({ "t3code:fork:recent-threads:timeout-minutes:v1": value });
    expect(readTimeoutMinutes(stored(""))).toBe(30);
    expect(readTimeoutMinutes(stored("45"))).toBe(30);
  });
});
