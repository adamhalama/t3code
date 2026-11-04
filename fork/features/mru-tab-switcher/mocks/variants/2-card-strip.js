(function () {
  "use strict";
  var ui = T3Replica.ui;

  function card(t, i, ctx) {
    var p = ui.projectOf(t);
    var env = ui.envOf(t);
    var selected = i === ctx.selected;
    var info = ui.statusInfo(t);
    return (
      '<li class="v2-card' +
      (selected ? " is-selected" : "") +
      (i === 0 ? " is-current" : "") +
      '" role="option" aria-selected="' +
      selected +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      '<div class="v2-card-top">' +
      ui.favicon(p) +
      '<span class="v2-project">' +
      ui.esc(p.name) +
      "</span>" +
      '<span class="v2-time">' +
      (i === 0 ? "current" : ui.esc(t.time)) +
      "</span></div>" +
      '<div class="v2-title">' +
      ui.esc(t.title) +
      "</div>" +
      '<div class="v2-snippet">' +
      ui.esc(t.snippet) +
      "</div>" +
      '<div class="v2-card-bottom">' +
      (info ? ui.status(t, "label") : '<span class="v2-idle">Idle</span>') +
      '<span class="v2-card-icons">' +
      (env.remote ? '<span class="t3-remote" title="' + ui.esc(env.label) + '">' + ui.icon("server", "") + "</span>" : "") +
      ui.providerIcon(t.provider, "is-muted") +
      "</span></div></li>"
    );
  }

  T3Replica.mount({
    number: 2,
    name: "Card strip",
    renderOverlay: function (ctx) {
      if (!ctx.open) return "";
      var sel = ctx.mruThreads[ctx.selected];
      var dots = ctx.mruThreads
        .map(function (_, i) {
          return '<span class="v2-dot' + (i === ctx.selected ? " is-on" : "") + '"></span>';
        })
        .join("");
      return (
        '<div class="t3-backdrop" data-action="mru-cancel"></div>' +
        '<div class="v2-stage" role="dialog" aria-label="Recent threads">' +
        '<div class="v2-tray t3-glass"><ul class="v2-track" role="listbox">' +
        ctx.mruThreads
          .map(function (t, i) {
            return card(t, i, ctx);
          })
          .join("") +
        "</ul></div>" +
        '<div class="v2-caption"><span class="v2-caption-title">' +
        ui.esc(sel.title) +
        '</span><span class="v2-dots" aria-hidden="true">' +
        dots +
        "</span>" +
        '<span class="v2-hints"><span class="t3-hint">' +
        ui.kbd("Tab") +
        ui.kbd("Shift Tab") +
        ' move</span><span class="t3-hint">release ' +
        ui.kbd("Ctrl") +
        ' to open</span><span class="t3-hint">' +
        ui.kbd("Esc") +
        " cancel</span></span></div></div>"
      );
    },
    afterRender: function (layer) {
      var track = layer.querySelector(".v2-track");
      var sel = layer.querySelector(".v2-card.is-selected");
      if (!track || !sel) return;
      var target = sel.offsetLeft - (track.clientWidth - sel.offsetWidth) / 2;
      track.scrollLeft = Math.max(0, target);
    },
  });
})();
