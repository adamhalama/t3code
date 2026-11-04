(function () {
  "use strict";

  var lastPillY = null;

  function rel(el, layerRect) {
    var r = el.getBoundingClientRect();
    return { left: r.left - layerRect.left, right: r.right - layerRect.left, top: r.top - layerRect.top, mid: r.top + r.height / 2 - layerRect.top };
  }

  // Bracket from the highlighted sidebar row to the highlighted list row.
  function connectorPath(x1, y1, xRail, x2, y2) {
    var r = Math.min(6, Math.abs(y2 - y1) / 2);
    if (r < 1) return "M" + x1 + " " + y1 + " H" + x2;
    var dir = y2 > y1 ? 1 : -1;
    return (
      "M" + x1 + " " + y1 +
      " H" + (xRail - r) +
      " Q" + xRail + " " + y1 + " " + xRail + " " + (y1 + dir * r) +
      " V" + (y2 - dir * r) +
      " Q" + xRail + " " + y2 + " " + (xRail + r) + " " + y2 +
      " H" + x2
    );
  }

  Combined.mount({
    number: 2,
    name: "Docked to sidebar",
    renderList: function (ctx, h) {
      return (
        '<svg class="c2-connector cx-no-hit" aria-hidden="true"><path d=""/></svg>' +
        '<div class="c2-panel cx-anim" role="dialog" aria-label="Recent threads">' +
        '<div class="c2-head"><span class="c2-label">Recent threads</span><span class="c2-pos">' +
        h.position(ctx) +
        "</span>" +
        h.toggleBtn("chevron-left", "Hide list") +
        "</div>" +
        '<ul class="cx-list c2-list" role="listbox">' +
        h.listRows(ctx, { badge: true, twoLine: true, status: "icon", current: false }) +
        "</ul>" +
        h.footer({ compact: true, toggleLabel: "hide" }) +
        "</div>"
      );
    },
    renderPill: function (ctx, h) {
      return (
        '<div class="c2-tab cx-pill cx-anim" data-mru-toggle role="button" aria-label="Show list" title="' +
        h.ui.esc(h.PILL_TITLE) +
        '"><span class="c2-tab-pos">' +
        h.position(ctx) +
        "</span>" +
        h.ui.icon("chevron-right", "c2-tab-chevron") +
        "</div>"
      );
    },
    afterRender: function (layer, ctx, root, h) {
      if (!ctx.open) {
        lastPillY = null;
        return;
      }
      var sb = h.selectedSidebarEl(root, layer);
      if (!sb) return;
      var lr = layer.getBoundingClientRect();
      var a = rel(sb, lr);
      var tab = layer.querySelector(".c2-tab");
      if (tab) {
        var y = Math.round(a.mid - 14);
        // The tab rides along the sidebar edge as the selection jumps.
        if (lastPillY !== null && lastPillY !== y && !ctx.s.instant) {
          tab.style.transition = "none";
          tab.style.top = lastPillY + "px";
          void tab.offsetHeight;
          tab.style.transition = "";
        }
        tab.style.top = y + "px";
        lastPillY = y;
        return;
      }
      lastPillY = null;
      var row = layer.querySelector(".c2-list .cx-row.is-selected");
      var svg = layer.querySelector(".c2-connector");
      if (!row || !svg) return;
      var b = rel(row, lr);
      var panel = rel(layer.querySelector(".c2-panel"), lr);
      svg.querySelector("path").setAttribute("d", connectorPath(Math.round(a.right), Math.round(a.mid), Math.round(panel.left + 10), Math.round(b.left), Math.round(b.mid)));
    },
  });
})();
