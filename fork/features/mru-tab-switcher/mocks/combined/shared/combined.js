/*
 * Shared behaviour for the combined (Quick Open list + sidebar-native) mocks.
 * The sidebar always carries the selection; the list mirrors it and can be
 * folded into a pill. Variants supply placement via Combined.mount({...}).
 */
(function (global) {
  "use strict";

  var ui = T3Replica.ui;

  // 4th entry lives in the collapsed Settled shelf, so cycling there makes the
  // sidebar reveal and scroll to it.
  var INITIAL_MRU = ["t-mru", "t-msi", "t-sweep", "t-wix", "t-sync", "t-pair", "t-cpu", "t-audit", "t-lock"];
  var LIST_PREF_KEY = "mru-combined-list";

  var PRESETS = [
    { id: "open", label: "List open (2nd)" },
    { id: "cycled", label: "Cycled to 4th (Settled)" },
    { id: "pill", label: "List collapsed (pill)" },
    { id: "cycled-pill", label: "Pill, cycled to 4th" },
    { id: "sidebar-collapsed", label: "Sidebar collapsed" },
    { id: "sidebar-collapsed-pill", label: "Sidebar collapsed + pill" },
    { id: "single", label: "Only one thread" },
    { id: "long", label: "Long titles" },
    { id: "idle", label: "Reset" },
  ];

  // preset id -> [base preset, list collapsed]
  var PRESET_MAP = {
    open: ["open", false],
    cycled: ["cycled", false],
    pill: ["open", true],
    "cycled-pill": ["cycled", true],
    "sidebar-collapsed": ["collapsed", false],
    "sidebar-collapsed-pill": ["collapsed", true],
    single: ["single"],
    long: ["long", false],
    idle: ["idle"],
  };

  function applyPreset(store, id) {
    var m = PRESET_MAP[id] || PRESET_MAP.idle;
    store.applyPreset(m[0], m.length > 1 ? { listCollapsed: m[1] } : {});
  }

  var TOGGLE_KEY_LABEL = "Ctrl+L";
  var PILL_TITLE =
    "Ctrl+Tab switch in progress. The list is hidden and stays hidden next time. Click or press " +
    TOGGLE_KEY_LABEL +
    " to show it.";
  var HIDE_TITLE = "Hide list (" + TOGGLE_KEY_LABEL + "). Remembered for the next Ctrl+Tab.";

  function badge(i, ctx, extra) {
    return (
      '<span class="cx-badge' + (i === ctx.selected ? " is-selected" : "") + (extra ? " " + extra : "") + '">' + (i + 1) + "</span>"
    );
  }

  function position(ctx) {
    return ctx.selected + 1 + "/" + ctx.mruThreads.length;
  }

  function toggleBtn(iconName, label, extraCls) {
    return (
      '<button type="button" tabindex="-1" class="cx-toggle ' +
      (extraCls || "") +
      '" data-mru-toggle aria-label="' +
      ui.esc(label) +
      '" title="' +
      ui.esc(label === "Show list" ? PILL_TITLE : HIDE_TITLE) +
      '">' +
      ui.icon(iconName) +
      "</button>"
    );
  }

  function hint(keys, label) {
    return (
      '<span class="t3-hint">' +
      keys
        .map(function (k) {
          return ui.kbd(k);
        })
        .join("") +
      (label ? " " + label : "") +
      "</span>"
    );
  }

  // Standard command-palette footer; `toggleHint` is always included.
  function footer(opts) {
    opts = opts || {};
    return (
      '<div class="t3-palette-footer cx-footer">' +
      (opts.compact ? "" : hint(["Tab"], "next") + hint(["Shift", "Tab"], "back")) +
      '<span class="t3-hint">release' + ui.kbd("Ctrl") + "open</span>" +
      (opts.compact ? "" : hint(["Esc"], "")) +
      '<span class="cx-grow"></span>' +
      hint(["Ctrl", "L"], opts.toggleLabel || "hide list") +
      "</div>"
    );
  }

  // One recent-list row. Options: badge, number, twoLine, project, status
  // ("label" | "icon" | false), location, current.
  function listRow(t, i, ctx, o) {
    o = o || {};
    var p = ui.projectOf(t);
    var env = ui.envOf(t);
    var sel = i === ctx.selected;
    var info = ui.statusInfo(t);
    var project =
      o.project === false
        ? ""
        : '<span class="cx-row-project">' +
          (env.remote ? ui.icon("server", "cx-env") : "") +
          '<span class="cx-ellipsis">' +
          ui.esc(p.name) +
          "</span></span>";
    var title = '<span class="cx-row-title">' + ui.esc(t.title) + "</span>";
    var end = "";
    if (o.status !== false) {
      end =
        '<span class="cx-row-end">' +
        (info ? ui.status(t, o.status || "label") : '<span class="t3-time">' + ui.esc(t.time) + "</span>") +
        "</span>";
    }
    return (
      '<li class="cx-row' +
      (sel ? " is-selected" : "") +
      (i === 0 ? " is-current" : "") +
      (o.twoLine ? " is-two-line" : "") +
      '" role="option" aria-selected="' +
      sel +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      (o.badge ? badge(i, ctx) : "") +
      (o.number ? '<span class="cx-num">' + (i + 1) + "</span>" : "") +
      ui.favicon(p) +
      (o.twoLine ? '<span class="cx-row-text">' + title + project + "</span>" : title + project) +
      (o.location && t.section === "settled" ? '<span class="cx-loc">in Settled</span>' : "") +
      (i === 0 && o.current !== false ? '<span class="cx-current-tag">current</span>' : "") +
      end +
      "</li>"
    );
  }

  function listRows(ctx, o) {
    return ctx.mruThreads
      .map(function (t, i) {
        return listRow(t, i, ctx, o);
      })
      .join("");
  }

  // Default "you are switching" bar at the top of the sidebar.
  function sidebarBar(ctx) {
    return (
      '<div class="cx-sbbar">' +
      ui.icon("history", "cx-sbbar-icon") +
      '<span class="cx-sbbar-label">Recent</span>' +
      '<span class="cx-sbbar-pos">' +
      position(ctx) +
      "</span></div>"
    );
  }

  function panelRow(t, i, ctx) {
    var p = ui.projectOf(t);
    var sel = i === ctx.selected;
    var info = ui.statusInfo(t);
    return (
      '<li class="cx-panel-row' +
      (sel ? " is-selected" : " cx-dim") +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      badge(i, ctx) +
      ui.favicon(p) +
      '<span class="cx-panel-text"><span class="cx-panel-title">' +
      ui.esc(t.title) +
      '</span><span class="cx-panel-project">' +
      ui.esc(p.name) +
      "</span></span>" +
      (info ? ui.status(t, "icon") : '<span class="t3-time">' + ui.esc(t.time) + "</span>") +
      "</li>"
    );
  }

  // Collapsed sidebar: the slim slide-in panel from direction 3 stands in.
  function slidePanel(ctx, top) {
    return (
      '<div class="cx-scrim" aria-hidden="true"></div>' +
      '<aside class="cx-panel" aria-label="Recent threads (sidebar)">' +
      '<div class="cx-panel-head"><span class="t3-wordmark"><b>T3</b> Code</span></div>' +
      top +
      '<ul class="cx-panel-list">' +
      ctx.mruThreads
        .map(function (t, i) {
          return panelRow(t, i, ctx);
        })
        .join("") +
      "</ul></aside>"
    );
  }

  function selectedSidebarEl(root, layer) {
    return root.querySelector(".t3-sidebar .t3-row.cx-selected") || layer.querySelector(".cx-panel-row.is-selected");
  }

  var helpers = {
    ui: ui,
    badge: badge,
    position: position,
    toggleBtn: toggleBtn,
    hint: hint,
    footer: footer,
    listRow: listRow,
    listRows: listRows,
    sidebarBar: sidebarBar,
    selectedSidebarEl: selectedSidebarEl,
    PILL_TITLE: PILL_TITLE,
    HIDE_TITLE: HIDE_TITLE,
  };

  function mount(cfg) {
    return T3Replica.mount({
      number: cfg.number,
      name: cfg.name,
      storeOptions: { initialMru: INITIAL_MRU, listPrefKey: LIST_PREF_KEY },
      states: Object.keys(PRESET_MAP),
      presets: PRESETS,
      applyPreset: applyPreset,
      demoHelp:
        "Keys: hold <b>Ctrl</b> or <b>Alt</b> + <b>`</b> (Shift+` = previous), release to open, Esc cancels. " +
        "While held: <b>Ctrl+L</b> (or Alt+L) toggles list/pill; clicking the chevron or pill with Ctrl held does not commit. " +
        "The list/pill choice is saved in localStorage and reused on the next switch.",
      decorateRow: function (t, ctx) {
        if (!ctx.open || ctx.s.collapsed) return null;
        var i = ctx.mruIndex(t.id);
        if (i < 0) return null;
        var cls = i === ctx.selected ? "cx-selected" : "cx-dim" + (i === 0 ? " cx-current" : "");
        return { cls: cls, slot: '<span class="cx-slot">' + ui.status(t, "icon") + badge(i, ctx) + "</span>" };
      },
      // Collapsed shelves open just enough to show the selected thread.
      revealRow: function (t, ctx) {
        return ctx.open && !ctx.s.collapsed && ctx.mruIndex(t.id) === ctx.selected;
      },
      sidebarTop: function (ctx) {
        if (!ctx.open || ctx.s.collapsed) return null;
        return cfg.sidebarTop ? cfg.sidebarTop(ctx, helpers) : sidebarBar(ctx);
      },
      renderOverlay: function (ctx) {
        if (!ctx.open) return "";
        var html = "";
        if (ctx.s.collapsed) html += slidePanel(ctx, cfg.sidebarTop ? cfg.sidebarTop(ctx, helpers) : sidebarBar(ctx));
        html += ctx.s.listCollapsed ? cfg.renderPill(ctx, helpers) : cfg.renderList(ctx, helpers);
        return html;
      },
      afterRender: function (layer, ctx, root) {
        var open = ctx.open;
        root.classList.toggle("cx-switching", open);
        root.dataset.list = open ? (ctx.s.listCollapsed ? "pill" : "list") : "";
        layer.classList.toggle("is-toggling", /^list-/.test(ctx.s.lastEvent));
        if (!open) {
          if (cfg.afterRender) cfg.afterRender(layer, ctx, root, helpers);
          return;
        }
        var sb = selectedSidebarEl(root, layer);
        if (sb) sb.scrollIntoView({ block: "nearest" });
        var row = layer.querySelector(".cx-row.is-selected");
        if (row) row.scrollIntoView({ block: "nearest" });
        if (cfg.afterRender) cfg.afterRender(layer, ctx, root, helpers);
      },
    });
  }

  global.Combined = { mount: mount, helpers: helpers, INITIAL_MRU: INITIAL_MRU, LIST_PREF_KEY: LIST_PREF_KEY };
})(window);
