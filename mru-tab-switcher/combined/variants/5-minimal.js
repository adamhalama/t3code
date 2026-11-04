(function () {
  "use strict";

  Combined.mount({
    number: 5,
    name: "Minimal",
    renderList: function (ctx, h) {
      var ui = h.ui;
      return (
        '<div class="c5-list-wrap cx-anim" role="dialog" aria-label="Recent threads">' +
        '<ul class="cx-list c5-list" role="listbox">' +
        h.listRows(ctx, { number: true, status: false, current: false }) +
        "</ul>" +
        '<div class="c5-foot">release' +
        ui.kbd("Ctrl") +
        '<span class="c5-dot">·</span>' +
        ui.kbd("Ctrl") +
        ui.kbd("L") +
        "hide" +
        h.toggleBtn("chevrons-down-up", "Hide list", "c5-fold") +
        "</div></div>"
      );
    },
    renderPill: function (ctx, h) {
      var ui = h.ui;
      return (
        '<div class="c5-pill cx-pill cx-anim" data-mru-toggle role="button" aria-label="Show list" title="' +
        ui.esc(h.PILL_TITLE) +
        '"><span class="c5-pill-dot" aria-hidden="true"></span>' +
        ui.kbd("Ctrl") +
        ui.kbd("Tab") +
        '<span class="c5-pill-pos">' +
        h.position(ctx) +
        "</span></div>"
      );
    },
  });
})();
