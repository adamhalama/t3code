(function () {
  "use strict";

  function wrap(i, n) {
    return ((i % n) + n) % n;
  }

  Combined.mount({
    number: 3,
    name: "Top list + bottom pill",
    renderList: function (ctx, h) {
      var ui = h.ui;
      return (
        '<div class="c3-panel t3-glass cx-anim" role="dialog" aria-label="Recent threads">' +
        '<div class="c3-head">Recent threads <span class="c3-pos">' +
        (ctx.selected + 1) +
        " of " +
        ctx.mruThreads.length +
        "</span></div>" +
        '<ul class="cx-list c3-list" role="listbox">' +
        h.listRows(ctx, { location: true }) +
        "</ul>" +
        '<div class="t3-palette-footer cx-footer">' +
        h.hint(["Tab"], "next") +
        h.hint(["Shift", "Tab"], "back") +
        '<span class="t3-hint">release' +
        ui.kbd("Ctrl") +
        "open</span>" +
        '<span class="cx-grow"></span>' +
        '<button type="button" tabindex="-1" class="c3-fold" data-mru-toggle aria-label="Hide list" title="' +
        ui.esc(h.HIDE_TITLE) +
        '">' +
        ui.icon("chevrons-down-up", "c3-fold-icon") +
        "Hide list" +
        ui.kbd("Ctrl") +
        ui.kbd("L") +
        "</button></div></div>"
      );
    },
    renderPill: function (ctx, h) {
      var ui = h.ui;
      var n = ctx.mruThreads.length;
      var prev = ctx.mruThreads[wrap(ctx.selected - 1, n)];
      var next = ctx.mruThreads[wrap(ctx.selected + 1, n)];
      var t = ctx.mruThreads[ctx.selected];
      var info = ui.statusInfo(t);
      return (
        '<div class="c3-hud cx-anim">' +
        '<div class="c3-pill t3-glass cx-pill" data-mru-toggle role="button" aria-label="Show list" title="' +
        ui.esc(h.PILL_TITLE) +
        '">' +
        '<span class="c3-side is-prev">' +
        ui.esc(prev.title) +
        "</span>" +
        '<span class="c3-current">' +
        (info ? ui.status(t, "dot") : "") +
        ui.favicon(ui.projectOf(t)) +
        '<span class="c3-title">' +
        ui.esc(t.title) +
        "</span></span>" +
        '<span class="c3-side is-next">' +
        ui.esc(next.title) +
        "</span>" +
        ui.icon("chevron-up", "c3-expand") +
        "</div>" +
        '<div class="c3-caption">' +
        h.position(ctx) +
        " · " +
        ui.esc(ui.projectOf(t).name) +
        (t.section === "settled" ? " · in Settled" : "") +
        "</div></div>"
      );
    },
  });
})();
