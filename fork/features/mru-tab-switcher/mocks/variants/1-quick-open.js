(function () {
  "use strict";
  var ui = T3Replica.ui;

  function row(t, i, ctx) {
    var p = ui.projectOf(t);
    var env = ui.envOf(t);
    var selected = i === ctx.selected;
    var info = ui.statusInfo(t);
    return (
      '<li class="v1-row' +
      (selected ? " is-selected" : "") +
      '" role="option" aria-selected="' +
      selected +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      ui.favicon(p) +
      '<span class="v1-title">' +
      ui.esc(t.title) +
      "</span>" +
      '<span class="v1-project">' +
      (env.remote ? ui.icon("server", "v1-env") : "") +
      '<span class="v1-project-name">' +
      ui.esc(p.name) +
      "</span></span>" +
      (i === 0 ? '<span class="v1-current">current</span>' : "") +
      '<span class="v1-end">' +
      (info ? ui.status(t, "label") : '<span class="t3-time">' + ui.esc(t.time) + "</span>") +
      "</span></li>"
    );
  }

  T3Replica.mount({
    number: 1,
    name: "Quick Open list",
    renderOverlay: function (ctx) {
      if (!ctx.open) return "";
      var rows = ctx.mruThreads
        .map(function (t, i) {
          return row(t, i, ctx);
        })
        .join("");
      return (
        '<div class="v1-panel t3-glass" role="dialog" aria-label="Recent threads">' +
        '<div class="v1-label"><span>Recent threads</span><span class="v1-count">' +
        ctx.mruThreads.length +
        "</span></div>" +
        '<ul class="v1-list" role="listbox">' +
        rows +
        "</ul>" +
        '<div class="t3-palette-footer">' +
        '<span class="t3-hint">' +
        ui.kbd("Ctrl") +
        ui.kbd("Tab") +
        " Next</span>" +
        '<span class="t3-hint">' +
        ui.kbd("Shift") +
        ui.kbd("Tab") +
        " Previous</span>" +
        '<span class="t3-hint v1-grow">Release ' +
        ui.kbd("Ctrl") +
        " to open</span>" +
        '<span class="t3-hint">' +
        ui.kbd("Esc") +
        " Cancel</span></div></div>"
      );
    },
    afterRender: function (layer) {
      var sel = layer.querySelector(".v1-row.is-selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    },
  });
})();
