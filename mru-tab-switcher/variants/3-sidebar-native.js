(function () {
  "use strict";
  var ui = T3Replica.ui;

  function badge(i, ctx) {
    return '<span class="v3-badge' + (i === ctx.selected ? " is-selected" : "") + '">' + (i + 1) + "</span>";
  }

  function slimPanelRow(t, i, ctx) {
    var p = ui.projectOf(t);
    var selected = i === ctx.selected;
    var info = ui.statusInfo(t);
    return (
      '<li class="v3-panel-row' +
      (selected ? " is-selected" : "") +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      badge(i, ctx) +
      ui.favicon(p) +
      '<span class="v3-panel-text"><span class="v3-panel-title">' +
      ui.esc(t.title) +
      '</span><span class="v3-panel-project">' +
      ui.esc(p.name) +
      "</span></span>" +
      (info ? ui.status(t, "icon") : '<span class="t3-time">' + ui.esc(t.time) + "</span>") +
      "</li>"
    );
  }

  function hintsRow() {
    return (
      '<div class="v3-top">' +
      ui.icon("history", "v3-top-icon") +
      '<span class="v3-top-label">Recent</span>' +
      '<span class="v3-top-hints">release' +
      ui.kbd("Ctrl") +
      "to open</span></div>"
    );
  }

  T3Replica.mount({
    number: 3,
    name: "Sidebar-native",
    // While held, the sidebar itself becomes the switcher.
    decorateRow: function (t, ctx) {
      if (!ctx.open || ctx.s.collapsed) return null;
      var i = ctx.mruIndex(t.id);
      if (i < 0) return null;
      var cls = i === ctx.selected ? "v3-selected" : i === 0 ? "v3-dim v3-current" : "v3-dim";
      return { cls: cls, slot: '<span class="v3-slot">' + ui.status(t, "icon") + badge(i, ctx) + "</span>" };
    },
    revealRow: function (t, ctx) {
      return ctx.open && !ctx.s.collapsed && ctx.mruIndex(t.id) >= 0;
    },
    sidebarTop: function (ctx) {
      return ctx.open && !ctx.s.collapsed ? hintsRow() : null;
    },
    renderOverlay: function (ctx) {
      if (!ctx.open || !ctx.s.collapsed) return "";
      return (
        '<div class="v3-scrim" aria-hidden="true"></div>' +
        '<aside class="v3-panel" role="dialog" aria-label="Recent threads">' +
        '<div class="v3-panel-head"><span class="t3-wordmark"><b>T3</b> Code</span></div>' +
        hintsRow() +
        '<ul class="v3-panel-list" role="listbox">' +
        ctx.mruThreads
          .map(function (t, i) {
            return slimPanelRow(t, i, ctx);
          })
          .join("") +
        "</ul></aside>"
      );
    },
    afterRender: function (layer, ctx, root) {
      root.classList.toggle("v3-switching", ctx.open && !ctx.s.collapsed);
      if (!ctx.open) return;
      var sel = root.querySelector(".t3-row.v3-selected") || layer.querySelector(".v3-panel-row.is-selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    },
  });
})();
