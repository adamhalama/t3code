(function () {
  "use strict";
  var ui = T3Replica.ui;

  function row(t, i, ctx) {
    var p = ui.projectOf(t);
    var env = ui.envOf(t);
    var selected = i === ctx.selected;
    var info = ui.statusInfo(t);
    return (
      '<li class="v4-row' +
      (selected ? " is-selected" : "") +
      '" role="option" aria-selected="' +
      selected +
      '" data-mru-index="' +
      i +
      '" data-mru-commit="' +
      t.id +
      '">' +
      '<div class="v4-row-line1">' +
      '<span class="v4-row-title">' +
      ui.esc(t.title) +
      "</span>" +
      (info ? ui.status(t, "icon") : "") +
      "</div>" +
      '<div class="v4-row-line2">' +
      ui.favicon(p, "v4-fav") +
      '<span class="v4-row-project">' +
      ui.esc(p.name) +
      "</span>" +
      (env.remote ? ui.icon("server", "v4-env") : "") +
      '<span class="v4-row-time">' +
      (i === 0 ? "current" : ui.esc(t.time)) +
      "</span></div></li>"
    );
  }

  function preview(t) {
    var p = ui.projectOf(t);
    var env = ui.envOf(t);
    var info = ui.statusInfo(t);
    var statusBlock = "";
    if (t.status === "approval") {
      statusBlock =
        '<div class="v4-callout tone-warning">' +
        ui.icon("shield-question", "") +
        '<div><div class="v4-callout-title">Waiting for approval</div><code class="t3-code">' +
        ui.esc(t.pending) +
        "</code></div></div>";
    } else if (t.status === "failed") {
      statusBlock =
        '<div class="v4-callout tone-error">' +
        ui.icon("circle-alert", "") +
        '<div><div class="v4-callout-title">Turn failed</div><span class="v4-callout-text">' +
        ui.esc(t.error) +
        "</span></div></div>";
    } else if (t.status === "input") {
      statusBlock =
        '<div class="v4-callout tone-indigo">' +
        ui.icon("message-circle-question", "") +
        '<div><div class="v4-callout-title">Needs your answer</div></div></div>';
    } else if (t.status === "working") {
      statusBlock =
        '<div class="v4-callout tone-info">' +
        ui.icon("circle-dashed", "") +
        '<div><div class="v4-callout-title">' +
        ui.esc(t.work) +
        "</div></div></div>";
    }
    var files = t.diff && t.diff.files.length ? t.diff.files : [];
    return (
      '<div class="v4-preview-head">' +
      '<div class="v4-crumbs">' +
      ui.favicon(p) +
      "<span>" +
      ui.esc(p.name) +
      "</span>" +
      (env.remote ? '<span class="t3-crumb-env">' + ui.icon("server", "") + ui.esc(env.label) + "</span>" : "") +
      "</div>" +
      '<div class="v4-preview-title">' +
      ui.esc(t.title) +
      "</div>" +
      '<div class="v4-facts">' +
      (info ? ui.status(t, "label") : '<span class="v4-idle">Idle · ' + ui.esc(t.time) + "</span>") +
      '<span class="v4-fact">' +
      ui.providerIcon(t.provider, "") +
      ui.esc(t.model) +
      "</span></div></div>" +
      '<div class="v4-section"><div class="v4-branch">' +
      ui.icon(t.worktree ? "folder-git-2" : "git-branch", "v4-branch-icon") +
      '<span class="v4-branch-name">' +
      ui.esc(t.branch) +
      "</span>" +
      ui.diffLabel(t.diff) +
      (files.length ? '<span class="v4-files-count">' + files.length + (files.length === 1 ? " file" : " files") + "</span>" : "") +
      "</div>" +
      (files.length
        ? '<ul class="v4-files">' +
          files
            .map(function (f) {
              return "<li>" + ui.icon("file", "v4-file-icon") + "<span>" + ui.esc(f) + "</span></li>";
            })
            .join("") +
          "</ul>"
        : '<div class="v4-nochanges">No changes</div>') +
      "</div>" +
      '<div class="v4-section v4-messages">' +
      '<div class="v4-user"><span>' +
      ui.inline(t.prompt) +
      "</span></div>" +
      '<div class="v4-agent">' +
      ui.inline(t.reply) +
      "</div>" +
      statusBlock +
      "</div>"
    );
  }

  T3Replica.mount({
    number: 4,
    name: "List + preview",
    renderOverlay: function (ctx) {
      if (!ctx.open) return "";
      var sel = ctx.mruThreads[ctx.selected];
      return (
        '<div class="t3-backdrop" data-action="mru-cancel"></div>' +
        '<div class="v4-modal t3-glass" role="dialog" aria-label="Recent threads">' +
        '<div class="v4-body">' +
        '<div class="v4-list-col"><div class="v4-label">Recent threads</div><ul class="v4-list" role="listbox">' +
        ctx.mruThreads
          .map(function (t, i) {
            return row(t, i, ctx);
          })
          .join("") +
        "</ul></div>" +
        '<div class="v4-preview" data-mru-commit="' +
        sel.id +
        '">' +
        preview(sel) +
        "</div></div>" +
        '<div class="t3-palette-footer">' +
        '<span class="t3-hint">' +
        ui.kbd("Tab") +
        ui.kbd("Shift Tab") +
        ui.kbd("\u2191\u2193") +
        " Move</span>" +
        '<span class="t3-hint v4-grow">Release ' +
        ui.kbd("Ctrl") +
        " to open</span>" +
        '<span class="t3-hint">' +
        ui.kbd("Esc") +
        " Cancel</span></div></div>"
      );
    },
    afterRender: function (layer) {
      var sel = layer.querySelector(".v4-row.is-selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    },
  });
})();
