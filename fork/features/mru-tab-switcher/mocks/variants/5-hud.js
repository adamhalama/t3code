(function () {
  "use strict";
  var ui = T3Replica.ui;

  function side(t, i, cls) {
    return (
      '<span class="v5-side ' +
      cls +
      '" data-mru-commit="' +
      t.id +
      '" data-index="' +
      i +
      '">' +
      ui.esc(t.title) +
      "</span>"
    );
  }

  T3Replica.mount({
    number: 5,
    name: "Minimal HUD",
    renderOverlay: function (ctx) {
      if (!ctx.open) return "";
      var list = ctx.mruThreads;
      var n = list.length;
      var i = ctx.selected;
      var prevI = (i - 1 + n) % n;
      var nextI = (i + 1) % n;
      var t = list[i];
      var p = ui.projectOf(t);
      var info = ui.statusInfo(t);
      return (
        '<div class="v5-hud" role="status" aria-live="polite" aria-label="Switch to ' +
        ui.esc(t.title) +
        '">' +
        '<div class="v5-pill t3-glass">' +
        side(list[prevI], prevI, "is-prev") +
        '<span class="v5-sep" aria-hidden="true">\u00b7</span>' +
        '<span class="v5-current" data-mru-commit="' +
        t.id +
        '">' +
        (info ? ui.status(t, "dot") : "") +
        ui.favicon(p) +
        '<span class="v5-title">' +
        ui.esc(t.title) +
        "</span></span>" +
        '<span class="v5-sep" aria-hidden="true">\u00b7</span>' +
        side(list[nextI], nextI, "is-next") +
        "</div>" +
        '<div class="v5-caption">' +
        (i + 1) +
        " / " +
        n +
        " \u00b7 " +
        ui.esc(p.name) +
        (info ? " \u00b7 " + info.label : "") +
        "</div></div>"
      );
    },
  });
})();
