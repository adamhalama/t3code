(function () {
  "use strict";

  // While switching, the sidebar's Search row becomes this chip. It is the
  // toggle: expanded it anchors the popover, folded it carries the selection.
  function chip(ctx, h) {
    var ui = h.ui;
    var folded = ctx.s.listCollapsed;
    var t = ctx.mruThreads[ctx.selected];
    return (
      '<div class="c4-chip cx-pill' +
      (folded ? " is-folded" : " is-expanded") +
      '" data-mru-toggle role="button" aria-expanded="' +
      !folded +
      '" aria-label="' +
      (folded ? "Show list" : "Hide list") +
      '" title="' +
      ui.esc(folded ? h.PILL_TITLE : h.HIDE_TITLE) +
      '">' +
      ui.icon("history", "c4-chip-icon") +
      (folded
        ? '<span class="c4-chip-pos">' + h.position(ctx) + '</span><span class="c4-chip-title">' + ui.esc(t.title) + "</span>"
        : '<span class="c4-chip-label">Recent</span><span class="c4-chip-pos">' + h.position(ctx) + "</span>") +
      ui.icon(folded ? "chevron-right" : "chevron-left", "c4-chip-chevron") +
      "</div>"
    );
  }

  Combined.mount({
    number: 4,
    name: "Sidebar-header popover",
    sidebarTop: chip,
    renderList: function (ctx, h) {
      return (
        '<div class="c4-pop t3-glass cx-anim" role="dialog" aria-label="Recent threads">' +
        '<span class="c4-caret" aria-hidden="true"></span>' +
        '<ul class="cx-list c4-list" role="listbox">' +
        h.listRows(ctx, { badge: true, status: "icon", current: false }) +
        "</ul>" +
        h.footer({ compact: true, toggleLabel: "fold" }) +
        "</div>"
      );
    },
    renderPill: function () {
      return "";
    },
  });
})();
