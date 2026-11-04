/*
 * Shared design-variation selector (developer tooling, not part of the mock).
 * One ordered registry drives the links, the count and the active state.
 */
(function (global) {
  "use strict";

  var REGISTRY = [
    { number: 1, name: "Quick Open list", href: "1.html" },
    { number: 2, name: "Card strip", href: "2.html" },
    { number: 3, name: "Sidebar-native", href: "3.html" },
    { number: 4, name: "List + preview", href: "4.html" },
    { number: 5, name: "Minimal HUD", href: "5.html" },
  ];
  var HOME = { name: "Comparison index", href: "index.html" };
  var SIDE_KEY = "dm-selector-side";

  function currentFile() {
    var path = location.pathname.replace(/\/+$/, "");
    var last = path.slice(path.lastIndexOf("/") + 1);
    return last === "" ? "index.html" : decodeURIComponent(last);
  }

  function activeEntry() {
    var file = currentFile();
    for (var i = 0; i < REGISTRY.length; i++) if (REGISTRY[i].href === file) return REGISTRY[i];
    return null;
  }

  // Keep ?state= (and other params) when switching variants.
  function withQuery(href) {
    return href + location.search;
  }

  function readSide() {
    try {
      var v = localStorage.getItem(SIDE_KEY);
      return v === "left" || v === "right" ? v : "right";
    } catch (e) {
      return "right";
    }
  }

  function writeSide(v) {
    try {
      localStorage.setItem(SIDE_KEY, v);
    } catch (e) {}
  }

  var SVG_HOME =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';
  var SVG_DOCK =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6"/></svg>';

  var nav, links, dockBtn, side, onKey;

  function render() {
    var active = activeEntry();
    links.forEach(function (a, i) {
      var entry = REGISTRY[i];
      a.href = withQuery(entry.href);
      if (active && active.number === entry.number) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    nav.setAttribute("data-side", side);
    dockBtn.setAttribute("aria-label", side === "right" ? "Move selector to left" : "Move selector to right");
    dockBtn.title = dockBtn.getAttribute("aria-label");
  }

  function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY|OPTION)$/.test(tag)) return true;
    var role = el.getAttribute("role");
    if (role && /^(button|link|textbox|combobox|listbox|option|menu|menuitem|tab|slider|spinbutton|searchbox|switch|checkbox|radio|gridcell|treeitem)$/.test(role))
      return true;
    return el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1";
  }

  function mount() {
    side = "right";
    nav = document.createElement("nav");
    nav.className = "dm-sel";
    nav.setAttribute("aria-label", "Design variations");
    var html = "";
    html +=
      '<a class="dm-sel-btn dm-sel-home" href="' +
      HOME.href +
      '" aria-label="' +
      HOME.name +
      '" title="' +
      HOME.name +
      '">' +
      SVG_HOME +
      '</a><span class="dm-sel-rule" aria-hidden="true"></span><div class="dm-sel-numbers">';
    REGISTRY.forEach(function (entry) {
      html +=
        '<a class="dm-sel-btn dm-sel-num" data-number="' +
        entry.number +
        '" aria-label="Variation ' +
        entry.number +
        ": " +
        entry.name +
        '" title="' +
        entry.number +
        " · " +
        entry.name +
        '">' +
        entry.number +
        "</a>";
    });
    html +=
      '</div><span class="dm-sel-rule" aria-hidden="true"></span><button type="button" class="dm-sel-btn dm-sel-dock">' +
      SVG_DOCK +
      "</button>";
    nav.innerHTML = html;
    document.body.appendChild(nav);
    links = Array.prototype.slice.call(nav.querySelectorAll(".dm-sel-num"));
    dockBtn = nav.querySelector(".dm-sel-dock");
    dockBtn.addEventListener("click", function () {
      side = side === "right" ? "left" : "right";
      writeSide(side);
      render();
    });
    render();
    // Restore docking after first paint (deterministic initial side).
    side = readSide();
    render();

    onKey = function (e) {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!/^[1-9]$/.test(e.key)) return;
      var n = Number(e.key);
      var entry = null;
      for (var i = 0; i < REGISTRY.length; i++) if (REGISTRY[i].number === n) entry = REGISTRY[i];
      if (!entry) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (!path.length) {
        for (var el = document.activeElement; el; el = el.parentElement) path.push(el);
      }
      for (var j = 0; j < path.length; j++) {
        if (path[j] === document.body || path[j] === document.documentElement) break;
        if (isInteractive(path[j])) return;
      }
      var focused = document.activeElement;
      for (var f = focused; f && f !== document.body; f = f.parentElement) if (isInteractive(f)) return;
      e.preventDefault();
      location.href = withQuery(entry.href);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", render);
    // Back/forward cache restores this page with its listeners intact; just resync links.
    window.addEventListener("pageshow", render);
  }

  global.DesignSelector = {
    registry: REGISTRY,
    refresh: function () {
      if (nav) render();
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(window);
