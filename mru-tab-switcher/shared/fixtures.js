/*
 * Shared fixtures, MRU logic and the Ctrl+Tab keyboard state machine for the
 * recent-thread switcher mocks. No dependencies; exposes window.MruMock.
 */
(function (global) {
  "use strict";

  var HOLD_DELAY_MS = 150;

  var ENVIRONMENTS = {
    local: { id: "local", label: "This PC", machine: "desktop", remote: false },
    devbox: { id: "devbox", label: "devbox · Tailscale", machine: "server", remote: true },
  };

  var PROJECTS = {
    t3code: { id: "t3code", name: "t3code", mark: "T3", bg: "#2563eb", fg: "#ffffff" },
    aqure: { id: "aqure", name: "AQURE.Portal", mark: "AQ", bg: "#0f766e", fg: "#ccfbf1" },
    occ: { id: "occ", name: "opencode-customizations", mark: "OC", bg: "#3f3f46", fg: "#f4f4f5" },
  };

  var PROVIDERS = {
    claude: { id: "claude", name: "Claude" },
    codex: { id: "codex", name: "Codex" },
  };

  // Sidebar order is activity order (the real sidebar), which deliberately
  // differs from the MRU order below.
  var THREADS = [
    {
      id: "t-mru",
      project: "t3code",
      env: "local",
      title: "Ctrl+Tab recent thread switcher",
      longTitle:
        "Ctrl+Tab recent thread switcher with hold delay, wraparound and click-to-open in the desktop app",
      status: "working",
      statusDetail: "4m 12s",
      time: "now",
      section: "working",
      branch: "fork/mru-tab-switcher",
      worktree: true,
      provider: "claude",
      model: "Opus 5.5 High",
      diff: { add: 214, del: 38, files: ["apps/web/src/recentThreads.ts", "apps/web/src/components/RecentThreadSwitcher.tsx", "packages/contracts/src/keybindings.ts"] },
      prompt: "Add a VS Code style Ctrl+Tab switcher for recently opened threads. Spec is in fork/features/mru-tab-switcher/SPEC.md.",
      work: "Working for 4m 12s",
      reply:
        "I added a per-client MRU list keyed by environment and thread id, and wired `thread.recent.next` / `thread.recent.previous` into the keybinding registry. Now building the picker overlay.",
      snippet: "Wired thread.recent.next into the keybinding registry; now building the picker overlay.",
    },
    {
      id: "t-msi",
      project: "aqure",
      env: "local",
      title: "Fix MSI upgrade losing IIS app pool identity",
      longTitle:
        "Fix MSI major upgrade losing the IIS application pool identity and custom bindings after repair on Windows Server 2022",
      status: "approval",
      time: "6m",
      section: "active",
      branch: "fix/msi-apppool-identity",
      worktree: false,
      provider: "codex",
      model: "GPT-5.6 Sol High",
      diff: { add: 47, del: 12, files: ["installer/Product.wxs", "installer/IisAppPool.wxs"] },
      prompt: "After a major upgrade the app pool runs as ApplicationPoolIdentity again. Find out why and fix it.",
      work: "Worked for 2m 40s",
      reply:
        "The upgrade removes the old component before the new one writes the identity, so the custom action reads defaults. I moved the identity write after `InstallFiles`.",
      snippet: "Wants to run: msiexec /i AQURE.Portal.msi /l*v upgrade.log",
      pending: "msiexec /i out\\AQURE.Portal.msi /l*v upgrade.log",
    },
    {
      id: "t-sync",
      project: "occ",
      env: "local",
      title: "Sync skills and plugins to laptop",
      longTitle:
        "Sync skills, agents and plugins from the customizations checkout to the laptop and restart T3 so they load",
      status: "done",
      time: "12m",
      section: "active",
      branch: "main",
      worktree: false,
      provider: "claude",
      model: "Sonnet 5",
      diff: { add: 3, del: 1, files: ["skills/design-mock/SKILL.md"] },
      prompt: "Refresh the laptop: sync customizations and restart T3.",
      work: "Worked for 58s",
      reply: "Fast-forwarded the checkout to `a41c2e9`, reapplied the Copilot preset and restarted T3 on the laptop. 3 skills changed.",
      snippet: "Fast-forwarded to a41c2e9 and restarted T3 on the laptop. 3 skills changed.",
    },
    {
      id: "t-sweep",
      project: "t3code",
      env: "local",
      title:
        "Sidebar settle sweep drops pinned threads when dragging across collapsed shelves on narrow windows",
      longTitle:
        "Sidebar settle sweep drops pinned threads when dragging across collapsed shelves on narrow windows and the Working shelf is expanded",
      status: "failed",
      time: "25m",
      section: "active",
      branch: "fix/settle-sweep-pinned",
      worktree: true,
      provider: "codex",
      model: "GPT-5.6 Terra",
      diff: { add: 18, del: 6, files: ["apps/web/src/components/Sidebar.drag.ts"] },
      prompt: "Pinned threads disappear when I sweep-settle across the Working shelf. Reproduce and fix.",
      work: "Worked for 6m 05s",
      reply: "`vp test run Sidebar.drag.test.ts` failed: 2 of 31 tests. The sweep treats pinned rows as settled targets.",
      snippet: "vp test run Sidebar.drag.test.ts failed: 2 of 31 tests.",
      error: "Provider exited: process terminated with code 1",
    },
    {
      id: "t-cpu",
      project: "t3code",
      env: "local",
      title: "Investigate composer CPU spike on 120 Hz displays",
      longTitle:
        "Investigate the composer CPU spike on 120 Hz displays when the status pulse and skeleton animations overlap",
      status: "input",
      time: "40m",
      section: "active",
      branch: "perf/composer-cpu",
      worktree: true,
      provider: "claude",
      model: "Opus 5.5 High",
      diff: null,
      prompt: "Composer pegs a core on my 120 Hz monitor while an agent is working. Profile it.",
      work: "Worked for 3m 31s",
      reply: "Two candidates: the working pulse and the skeleton shimmer. Should I step both animations or remove the shimmer?",
      snippet: "Should I step both animations or remove the shimmer?",
    },
    {
      id: "t-pair",
      project: "t3code",
      env: "devbox",
      title: "Review PR #4128 remote pairing token refresh",
      longTitle:
        "Review PR #4128: remote pairing token refresh races with the tunnel reconnect when the relay restarts",
      status: "idle",
      time: "1h",
      section: "active",
      branch: "t3/pairing-token-refresh",
      worktree: false,
      provider: "claude",
      model: "Opus 5.5",
      diff: { add: 0, del: 0, files: [] },
      prompt: "Review PR #4128 and leave comments for anything that breaks relay reconnects.",
      work: "Worked for 7m 44s",
      reply: "Left 3 comments. The refresh timer is not cancelled when the relay restarts, which can double-refresh the token.",
      snippet: "Left 3 comments. The refresh timer is not cancelled when the relay restarts.",
    },
    {
      id: "t-audit",
      project: "aqure",
      env: "local",
      title: "Add audit log retention migration",
      longTitle: "Add audit log retention migration with a configurable 90 day window and a backfill for existing rows",
      status: "idle",
      time: "2h",
      section: "active",
      branch: "feat/audit-retention",
      worktree: true,
      provider: "codex",
      model: "GPT-5.6 Terra",
      diff: { add: 96, del: 4, files: ["db/migrations/0042_audit_retention.sql", "src/Audit/RetentionJob.cs"] },
      prompt: "Add a migration that deletes audit rows older than the configured retention window.",
      work: "Worked for 4m 02s",
      reply: "Added `0042_audit_retention.sql` and a nightly `RetentionJob`. The window defaults to 90 days.",
      snippet: "Added 0042_audit_retention.sql and a nightly RetentionJob.",
    },
    {
      id: "t-lock",
      project: "occ",
      env: "local",
      title: "Handoff: installer test server lock",
      longTitle: "Handoff: installer test server lock renewal, stale lock cleanup and before/after snapshots",
      status: "idle",
      time: "5h",
      section: "settled",
      branch: "main",
      worktree: false,
      provider: "claude",
      model: "Sonnet 5",
      diff: null,
      prompt: "Write a handoff for the test server lock work.",
      work: "Worked for 1m 12s",
      reply: "Wrote the handoff with the lock protocol, renewal interval and the open question about stale locks.",
      snippet: "Wrote the handoff with the lock protocol and renewal interval.",
    },
    {
      id: "t-wix",
      project: "aqure",
      env: "local",
      title: "Translate WiX fragments to v5 syntax",
      longTitle: "Translate the remaining WiX v3 fragments to v5 syntax and drop the heat.exe harvesting step",
      status: "idle",
      time: "1d",
      section: "settled",
      branch: "chore/wix-v5",
      worktree: false,
      provider: "codex",
      model: "GPT-5.6 Sol",
      diff: { add: 312, del: 288, files: ["installer/Fragments/*.wxs"] },
      prompt: "Port the remaining fragments to WiX v5.",
      work: "Worked for 12m 40s",
      reply: "All 14 fragments compile under WiX v5. heat.exe is gone; files are harvested with `Files` elements.",
      snippet: "All 14 fragments compile under WiX v5.",
    },
  ];

  var INITIAL_MRU = ["t-mru", "t-msi", "t-sweep", "t-sync", "t-pair", "t-cpu", "t-audit", "t-wix", "t-lock"];

  var STATES = ["idle", "open", "cycled", "single", "long", "collapsed"];

  function cloneThreads(dataset) {
    return THREADS.map(function (t) {
      var copy = Object.assign({}, t);
      if (dataset === "long") copy.title = t.longTitle;
      return copy;
    });
  }

  function createStore() {
    var listeners = [];
    var timer = null;
    var s = {
      dataset: "default",
      threads: cloneThreads("default"),
      mru: INITIAL_MRU.slice(),
      activeId: INITIAL_MRU[0],
      collapsed: false,
      phase: "idle", // idle | pending | open
      selected: 0,
      held: false,
      justOpened: false,
      instant: false,
      note: null,
      lastEvent: "ready",
    };

    function emit(event) {
      s.lastEvent = event;
      listeners.forEach(function (fn) {
        fn(s, event);
      });
      s.justOpened = false;
    }

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function wrap(i) {
      var n = s.mru.length;
      return ((i % n) + n) % n;
    }

    function openNow() {
      clearTimer();
      if (s.phase !== "open") s.justOpened = true;
      s.phase = "open";
    }

    var api = {
      HOLD_DELAY_MS: HOLD_DELAY_MS,
      state: s,
      subscribe: function (fn) {
        listeners.push(fn);
      },
      thread: function (id) {
        for (var i = 0; i < s.threads.length; i++) if (s.threads[i].id === id) return s.threads[i];
        return null;
      },
      mruThreads: function () {
        return s.mru.map(api.thread).filter(Boolean);
      },
      selectedThread: function () {
        return api.thread(s.mru[s.selected]);
      },
      // Ctrl+Tab (dir 1) or Ctrl+Shift+Tab (dir -1) while the modifier is held.
      press: function (dir) {
        s.note = null;
        s.instant = false;
        if (s.mru.length < 2) {
          s.note = "Only one thread in the recent list: Ctrl+Tab does nothing.";
          emit("press-ignored");
          return;
        }
        if (s.phase === "idle") {
          s.phase = "pending";
          s.held = true;
          s.selected = dir > 0 ? 1 : s.mru.length - 1;
          clearTimer();
          timer = setTimeout(function () {
            timer = null;
            if (s.phase === "pending" && s.held) {
              openNow();
              emit("hold-delay-elapsed");
            }
          }, HOLD_DELAY_MS);
          emit("press");
          return;
        }
        s.selected = wrap(s.selected + dir);
        if (s.phase === "pending") openNow();
        emit(dir > 0 ? "next" : "previous");
      },
      move: function (dir) {
        if (s.phase === "idle") return;
        s.selected = wrap(s.selected + dir);
        if (s.phase === "pending") openNow();
        emit(dir > 0 ? "next" : "previous");
      },
      setSelected: function (index) {
        if (s.phase !== "open") return;
        s.selected = wrap(index);
        emit("hover");
      },
      // Releasing the modifier opens the selection (quick tap = previous thread).
      release: function () {
        if (s.phase === "idle") return;
        var id = s.mru[s.selected];
        var wasTap = s.phase === "pending";
        clearTimer();
        api.commitId(id, wasTap ? "tap-commit" : "release-commit");
      },
      cancel: function () {
        if (s.phase === "idle") return;
        clearTimer();
        s.phase = "idle";
        s.held = false;
        s.selected = 0;
        emit("cancel");
      },
      commitId: function (id, event) {
        clearTimer();
        if (!api.thread(id)) return;
        s.activeId = id;
        s.mru = [id].concat(
          s.mru.filter(function (x) {
            return x !== id;
          }),
        );
        s.phase = "idle";
        s.held = false;
        s.selected = 0;
        s.instant = false;
        emit(event || "click-commit");
      },
      toggleCollapsed: function () {
        s.collapsed = !s.collapsed;
        emit("toggle-sidebar");
      },
      // Static presets for screenshots: no timers, modifier treated as held.
      applyPreset: function (name) {
        clearTimer();
        s.dataset = name === "long" ? "long" : "default";
        s.threads = cloneThreads(s.dataset);
        s.mru = name === "single" ? ["t-mru"] : INITIAL_MRU.slice();
        if (name === "single") {
          s.threads = s.threads.filter(function (t) {
            return t.id === "t-mru";
          });
        }
        s.activeId = s.mru[0];
        s.collapsed = name === "collapsed";
        s.note = name === "single" ? "Only one thread in the recent list: Ctrl+Tab does nothing." : null;
        s.instant = true;
        s.justOpened = false;
        if (name === "open" || name === "long" || name === "collapsed") {
          s.phase = "open";
          s.held = true;
          s.selected = 1;
        } else if (name === "cycled") {
          s.phase = "open";
          s.held = true;
          s.selected = 3;
        } else {
          s.phase = "idle";
          s.held = false;
          s.selected = 0;
        }
        emit("preset:" + name);
      },
      refresh: function () {
        emit("refresh");
      },
    };
    return api;
  }

  // Real Ctrl+Tab (Electron) plus the browser-safe Ctrl/Alt + ` simulation.
  function installKeyboard(store) {
    function onKeyDown(e) {
      var s = store.state;
      var isTab = e.key === "Tab" && e.ctrlKey && !e.altKey && !e.metaKey;
      var isBacktick = e.code === "Backquote" && (e.ctrlKey || e.altKey) && !e.metaKey;
      if (isTab || isBacktick) {
        e.preventDefault();
        e.stopPropagation();
        store.press(e.shiftKey ? -1 : 1);
        return;
      }
      if (s.phase === "idle") return;
      if (e.key === "Escape") {
        e.preventDefault();
        store.cancel();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        store.move(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        store.move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        store.release();
      }
    }
    function onKeyUp(e) {
      if (store.state.phase === "idle") return;
      if (e.key === "Control" || e.key === "Alt") {
        e.preventDefault();
        store.release();
      }
    }
    function onBlur() {
      if (store.state.phase !== "idle" && !store.state.instant) store.cancel();
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return function uninstall() {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }

  global.MruMock = {
    HOLD_DELAY_MS: HOLD_DELAY_MS,
    ENVIRONMENTS: ENVIRONMENTS,
    PROJECTS: PROJECTS,
    PROVIDERS: PROVIDERS,
    THREADS: THREADS,
    INITIAL_MRU: INITIAL_MRU,
    STATES: STATES,
    createStore: createStore,
    installKeyboard: installKeyboard,
  };
})(window);
