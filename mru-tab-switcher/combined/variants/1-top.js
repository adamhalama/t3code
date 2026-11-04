(function () {
  "use strict";

  Combined.mount({
    number: 1,
    name: "Top list + top pill",
    renderList: function (ctx, h) {
      return (
        '<div class="c1-panel t3-glass cx-anim" role="dialog" aria-label="Recent threads">' +
        '<div class="c1-head"><span class="c1-label">Recent threads</span><span class="c1-pos">' +
        h.position(ctx) +
        "</span>" +
        h.toggleBtn("chevron-up", "Hide list") +
        "</div>" +
        '<ul class="cx-list" role="listbox">' +
        h.listRows(ctx, { badge: true }) +
        "</ul>" +
        h.footer() +
        "</div>"
      );
    },
    renderPill: function (ctx, h) {
      var t = ctx.mruThreads[ctx.selected];
      var ui = h.ui;
      return (
        '<div class="c1-pill t3-glass cx-pill cx-anim" data-mru-toggle role="button" aria-label="Show list" title="' +
        ui.esc(h.PILL_TITLE) +
        '">' +
        '<span class="c1-pill-keys">' +
        ui.kbd("Ctrl") +
        ui.kbd("Tab") +
        "</span>" +
        h.badge(ctx.selected, ctx) +
        ui.favicon(ui.projectOf(t)) +
        '<span class="c1-pill-title">' +
        ui.esc(t.title) +
        "</span>" +
        '<span class="c1-pill-of">of ' +
        ctx.mruThreads.length +
        "</span>" +
        ui.icon("chevron-down", "c1-pill-chevron") +
        "</div>"
      );
    },
  });
})();
