/*
 * Static replica of the T3 Code desktop window (dark theme) plus the shared
 * demo-controls strip. Variants call T3Replica.mount({...}) with their
 * switcher renderer. Exposes window.T3Replica.
 */
(function (global) {
  "use strict";

  var M = global.MruMock;

  // Lucide icon bodies (24x24, stroke 2), the icon set T3 Code uses.
  var ICONS = {
    "panel-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    "panel-right": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    "panel-bottom": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/>',
    "file-text":
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "list-filter": '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    "folder-plus":
      '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "square-pen":
      '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    "circle-dashed":
      '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
    "circle-dot-dashed":
      '<path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0"/><path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7"/><path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8"/><path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69"/><path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0"/><path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7"/><path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8"/><path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69"/><circle cx="12" cy="12" r="1"/>',
    "shield-question":
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "circle-alert":
      '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    "message-circle-question":
      '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    "git-branch":
      '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    "folder-git-2":
      '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>',
    server:
      '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    monitor:
      '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    settings:
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    "git-pull-request":
      '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/>',
    chart: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
    "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    "circle-arrow-up": '<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>',
    paperclip:
      '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-up": '<path d="m18 15-6-6-6 6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevrons-down-up": '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    "chevrons-up-down": '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    "corner-down-left": '<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
    minus: '<path d="M5 12h14"/>',
    square: '<rect width="14" height="14" x="5" y="5" rx="1"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "message-square": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  };

  function icon(name, cls) {
    return (
      '<svg class="t3-icon ' +
      (cls || "") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  function providerIcon(id, cls) {
    if (id === "codex") {
      // Simplified OpenAI knot.
      return (
        '<svg class="t3-provider ' +
        (cls || "") +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-label="Codex" role="img">' +
        '<path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6Z"/><path d="M12 3.2v8.8M19.6 16.4 12 12M4.4 16.4 12 12"/></svg>'
      );
    }
    var rays = "";
    for (var i = 0; i < 12; i++) {
      var a = (i * Math.PI) / 6;
      var r1 = 2.2,
        r2 = i % 2 ? 8.2 : 10;
      rays +=
        '<line x1="' +
        (12 + r1 * Math.cos(a)).toFixed(2) +
        '" y1="' +
        (12 + r1 * Math.sin(a)).toFixed(2) +
        '" x2="' +
        (12 + r2 * Math.cos(a)).toFixed(2) +
        '" y2="' +
        (12 + r2 * Math.sin(a)).toFixed(2) +
        '"/>';
    }
    return (
      '<svg class="t3-provider is-claude ' +
      (cls || "") +
      '" viewBox="0 0 24 24" fill="none" stroke="#d97757" stroke-width="2.1" stroke-linecap="round" aria-label="Claude" role="img">' +
      rays +
      "</svg>"
    );
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(md) {
    return esc(md).replace(/`([^`]+)`/g, '<code class="t3-code">$1</code>');
  }

  function favicon(project, cls) {
    return (
      '<span class="t3-favicon ' +
      (cls || "") +
      '" style="--fav-bg:' +
      project.bg +
      ";--fav-fg:" +
      project.fg +
      '" aria-hidden="true">' +
      esc(project.mark) +
      "</span>"
    );
  }

  var STATUS = {
    working: { label: "Working", icon: "circle-dashed", tone: "info" },
    waiting: { label: "Waiting", icon: "circle-dot-dashed", tone: "muted" },
    approval: { label: "Approval", icon: "shield-question", tone: "warning" },
    input: { label: "Input", icon: "message-circle-question", tone: "indigo" },
    failed: { label: "Failed", icon: "circle-alert", tone: "error" },
    done: { label: "Done", icon: "circle-check", tone: "success" },
  };

  function statusInfo(thread) {
    return STATUS[thread.status] || null;
  }

  // mode: "label" (icon + label, like sidebar cards), "icon", "dot", "slot" (label or time)
  function status(thread, mode) {
    var info = statusInfo(thread);
    if (mode === "slot" && !info) return '<span class="t3-time">' + esc(thread.time) + "</span>";
    if (!info) return "";
    var detail = thread.status === "working" && thread.statusDetail ? " " + esc(thread.statusDetail) : "";
    if (mode === "icon")
      return '<span class="t3-status tone-' + info.tone + '" title="' + info.label + '">' + icon(info.icon, "t3-status-icon") + "</span>";
    if (mode === "dot")
      return '<span class="t3-status-dot tone-' + info.tone + '" title="' + info.label + '"></span>';
    return (
      '<span class="t3-status tone-' +
      info.tone +
      '">' +
      icon(info.icon, "t3-status-icon") +
      '<span class="t3-status-label">' +
      info.label +
      detail +
      "</span></span>"
    );
  }

  function kbd(text, cls) {
    return '<kbd class="t3-kbd ' + (cls || "") + '">' + esc(text) + "</kbd>";
  }

  function envOf(thread) {
    return M.ENVIRONMENTS[thread.env];
  }

  function projectOf(thread) {
    return M.PROJECTS[thread.project];
  }

  function diffLabel(diff) {
    if (!diff || (!diff.add && !diff.del)) return "";
    return (
      '<span class="t3-diff"><span class="add">+' + diff.add + '</span> <span class="del">\u2212' + diff.del + "</span></span>"
    );
  }

  var UI = {
    icon: icon,
    providerIcon: providerIcon,
    esc: esc,
    inline: inline,
    favicon: favicon,
    status: status,
    statusInfo: statusInfo,
    kbd: kbd,
    envOf: envOf,
    projectOf: projectOf,
    diffLabel: diffLabel,
  };

  /* ---------- sidebar ---------- */

  function cardRow(t, ctx) {
    var p = projectOf(t);
    var env = envOf(t);
    var deco = ctx.decorate(t);
    var meta =
      (t.worktree ? icon("folder-git-2", "t3-meta-icon") : "") +
      '<span class="t3-card-branch">' +
      esc(t.branch || "") +
      "</span>" +
      diffLabel(t.diff) +
      '<span class="t3-card-meta-end">' +
      (env.remote ? '<span class="t3-remote" title="' + esc(env.label) + '">' + icon("server", "") + "</span>" : "") +
      providerIcon(t.provider, "is-muted") +
      "</span>";
    return (
      '<li class="t3-row-li">' +
      '<div class="t3-row t3-card' +
      (t.id === ctx.s.activeId ? " is-active" : "") +
      (deco.cls ? " " + deco.cls : "") +
      '" role="button" tabindex="0" data-thread-id="' +
      t.id +
      '"' +
      (t.id === ctx.s.activeId ? ' aria-current="page"' : "") +
      ">" +
      '<div class="t3-card-line1">' +
      favicon(p) +
      '<span class="t3-card-project">' +
      esc(p.name) +
      "</span>" +
      '<span class="t3-status-slot">' +
      (deco.slot != null ? deco.slot : status(t, "slot")) +
      "</span></div>" +
      '<div class="t3-card-title" title="' +
      esc(t.title) +
      '">' +
      esc(t.title) +
      "</div>" +
      '<div class="t3-card-meta">' +
      meta +
      "</div>" +
      "</div></li>"
    );
  }

  function slimRow(t, ctx) {
    var p = projectOf(t);
    var deco = ctx.decorate(t);
    return (
      '<li class="t3-row-li">' +
      '<div class="t3-row t3-slim' +
      (t.id === ctx.s.activeId ? " is-active" : "") +
      (deco.cls ? " " + deco.cls : "") +
      '" role="button" tabindex="0" data-thread-id="' +
      t.id +
      '">' +
      '<span class="t3-slim-fav">' +
      favicon(p) +
      "</span>" +
      '<span class="t3-slim-title">' +
      esc(t.title) +
      "</span>" +
      '<span class="t3-status-slot">' +
      (deco.slot != null ? deco.slot : status(t, "slot")) +
      "</span>" +
      "</div></li>"
    );
  }

  function shelfHeader(label, count, expanded) {
    return (
      '<div class="t3-shelf"><span>' +
      label +
      '</span><span class="t3-shelf-count">' +
      count +
      "</span>" +
      icon(expanded ? "chevron-down" : "chevron-right", "t3-shelf-chevron") +
      "</div>"
    );
  }

  function renderSidebar(ctx) {
    var s = ctx.s;
    var active = s.threads.filter(function (t) {
      return t.section === "active";
    });
    var working = s.threads.filter(function (t) {
      return t.section === "working";
    });
    var settled = s.threads.filter(function (t) {
      return t.section === "settled";
    });
    // A collapsed shelf still shows the open thread (routeThreadOnly); the
    // sidebar-native variant may reveal more while the switcher is held.
    var revealed = settled.filter(function (t) {
      return t.id === s.activeId || ctx.reveal(t);
    });
    var html = "";
    html +=
      '<div class="t3-sb-header">' +
      '<button class="t3-iconbtn" data-action="toggle-sidebar" title="Toggle sidebar">' +
      icon("panel-left") +
      "</button>" +
      '<span class="t3-wordmark"><b>T3</b> Code</span></div>';
    html += ctx.sidebarTop
      ? ctx.sidebarTop
      : '<div class="t3-sb-search">' +
        icon("search", "t3-sb-search-icon") +
        '<span class="t3-sb-search-label">Search</span>' +
        '<span class="t3-sb-search-actions">' +
        icon("list-filter") +
        icon("folder-plus") +
        icon("square-pen") +
        "</span></div>";
    html += '<div class="t3-sb-scroll"><ul class="t3-sb-list">';
    active.forEach(function (t) {
      html += cardRow(t, ctx);
    });
    html += '</ul><div class="t3-sb-spacer"></div>';
    if (working.length) {
      html += shelfHeader("Working", working.length, true) + '<ul class="t3-sb-list">';
      working.forEach(function (t) {
        html += cardRow(t, ctx);
      });
      html += "</ul>";
    }
    html += shelfHeader("Settled", 43, false) + '<ul class="t3-sb-list">';
    revealed.forEach(function (t) {
      html += slimRow(t, ctx);
    });
    html += "</ul></div>";
    html +=
      '<div class="t3-sb-footer">' +
      icon("settings") +
      icon("git-pull-request") +
      icon("chart") +
      '<span class="t3-sb-footer-end">' +
      icon("circle-arrow-up") +
      "</span></div>";
    return html;
  }

  /* ---------- main area ---------- */

  function renderMain(ctx) {
    var s = ctx.s;
    var t = ctx.store.thread(s.activeId);
    var p = projectOf(t);
    var env = envOf(t);
    var html = '<header class="t3-topbar">';
    if (s.collapsed) {
      html +=
        '<button class="t3-iconbtn" data-action="toggle-sidebar" title="Toggle sidebar">' +
        icon("panel-left") +
        '</button><span class="t3-wordmark t3-wordmark-inline"><b>T3</b> Code</span>';
    }
    html +=
      '<nav class="t3-crumbs">' +
      favicon(p) +
      '<span class="t3-crumb-project">' +
      esc(p.name) +
      "</span>" +
      (env.remote ? '<span class="t3-crumb-env">' + icon("server", "") + esc(env.label) + "</span>" : "") +
      '<span class="t3-crumb-sep">/</span><span class="t3-crumb-title">' +
      esc(t.title) +
      "</span></nav>" +
      '<div class="t3-topbar-tools">' +
      icon("file-text") +
      icon("panel-bottom") +
      icon("panel-right") +
      '<span class="t3-caption">' +
      icon("minus") +
      icon("square") +
      icon("x") +
      "</span></div></header>";

    html += '<div class="t3-timeline"><div class="t3-column">';
    html += '<div class="t3-user-row"><div class="t3-user-bubble">' + inline(t.prompt) + "</div></div>";
    if (t.status === "working") {
      html += '<div class="t3-reply">' + inline(t.reply) + "</div>";
      html +=
        '<div class="t3-worklog"><span class="t3-worklog-row">' +
        icon("terminal", "t3-wl-icon") +
        '<span class="t3-wl-label">Ran</span><code class="t3-code">vp test run recentThreads.test.ts</code></span>' +
        '<span class="t3-worklog-row">' +
        icon("file", "t3-wl-icon") +
        '<span class="t3-wl-label">Edited</span><code class="t3-code">RecentThreadSwitcher.tsx</code>' +
        diffLabel({ add: 88, del: 3 }) +
        "</span></div>";
      html +=
        '<div class="t3-working-line tone-info">' +
        icon("circle-dashed", "t3-status-icon") +
        "<span>" +
        esc(t.work) +
        '</span><span class="t3-stop">Stop</span></div>';
    } else {
      html += '<div class="t3-worked">' + esc(t.work) + icon("chevron-right", "") + "</div>";
      html += '<div class="t3-reply">' + inline(t.reply) + "</div>";
      if (t.status === "failed") {
        html += '<div class="t3-error-banner">' + icon("circle-alert", "") + "<span>" + esc(t.error) + "</span></div>";
      }
    }
    html += "</div></div>";

    html += '<div class="t3-composer-wrap"><div class="t3-column">';
    if (t.status === "approval") {
      html +=
        '<div class="t3-banner tone-warning">' +
        icon("shield-question", "") +
        '<span class="t3-banner-text">Run command? <code class="t3-code">' +
        esc(t.pending) +
        '</code></span><span class="t3-banner-actions"><span class="t3-btn ghost">Deny</span><span class="t3-btn">Approve</span></span></div>';
    } else if (t.status === "input") {
      html +=
        '<div class="t3-banner tone-indigo">' +
        icon("message-circle-question", "") +
        '<span class="t3-banner-text">The agent is waiting for your answer.</span></div>';
    }
    html +=
      '<div class="t3-composer"><div class="t3-composer-placeholder">Ask anything. @ files, $ skills, / commands</div>' +
      '<div class="t3-composer-bar">' +
      icon("paperclip", "t3-composer-attach") +
      '<span class="t3-composer-model">' +
      providerIcon(t.provider, "") +
      esc(t.model) +
      '</span><span class="t3-send">' +
      icon("arrow-up") +
      "</span></div></div>";
    html +=
      '<div class="t3-branchbar">' +
      icon(env.remote ? "server" : "monitor", "") +
      "<span>" +
      esc(env.remote ? env.label : "Local") +
      "</span>" +
      icon("git-branch", "") +
      "<span>" +
      esc(t.branch) +
      "</span></div>";
    html += "</div></div>";
    return html;
  }

  /* ---------- demo controls (tooling, not part of the design) ---------- */

  var PRESETS = [
    { id: "open", label: "Picker open (2nd selected)" },
    { id: "cycled", label: "Cycled to 4th" },
    { id: "single", label: "Only one thread" },
    { id: "long", label: "Long titles" },
    { id: "collapsed", label: "Sidebar collapsed" },
    { id: "idle", label: "Reset" },
  ];

  function applyPresetFor(variant, store, id) {
    if (variant.applyPreset) variant.applyPreset(store, id);
    else store.applyPreset(id);
  }

  function buildDemo(store, variant) {
    var presets = variant.presets || PRESETS;
    var el = document.createElement("section");
    el.className = "mru-demo";
    el.setAttribute("aria-label", "Demo controls (not part of the design)");
    var collapsed = false;
    try {
      collapsed = localStorage.getItem("mru-demo-collapsed") === "1";
    } catch (e) {}
    el.innerHTML =
      '<div class="mru-demo-head"><span class="mru-demo-tag">DEMO</span><span class="mru-demo-title">' +
      esc(variant.number + " · " + variant.name) +
      '</span><button type="button" class="mru-demo-fold" data-demo="fold" aria-expanded="true">hide</button></div>' +
      '<div class="mru-demo-body">' +
      '<div class="mru-demo-row">' +
      '<button type="button" data-demo="tap">Tap</button>' +
      '<button type="button" data-demo="hold">Hold+Next</button>' +
      '<button type="button" data-demo="next">Next</button>' +
      '<button type="button" data-demo="prev">Previous</button>' +
      '<button type="button" data-demo="release">Release</button>' +
      '<button type="button" data-demo="esc">Esc</button>' +
      (store.hasListToggle
        ? '<button type="button" data-demo="toggle-list">Toggle list</button>' +
          '<button type="button" data-demo="forget">Forget saved list choice</button>'
        : "") +
      "</div>" +
      '<div class="mru-demo-row">' +
      presets.map(function (p) {
        return '<button type="button" class="preset" data-preset="' + p.id + '">' + esc(p.label) + "</button>";
      }).join("") +
      "</div>" +
      '<div class="mru-demo-help">' +
      (variant.demoHelp ||
        "Keys: hold <b>Ctrl</b> or <b>Alt</b> + <b>`</b> (Shift+` = previous), release to open, Esc cancels. Real Ctrl+Tab works in Electron.") +
      "</div>" +
      '<div class="mru-demo-readout" data-demo-readout></div>' +
      '<div class="mru-demo-note" data-demo-note hidden></div>' +
      "</div>";
    document.body.appendChild(el);

    function setFold(v) {
      collapsed = v;
      el.classList.toggle("is-folded", v);
      var b = el.querySelector("[data-demo=fold]");
      b.textContent = v ? "show" : "hide";
      b.setAttribute("aria-expanded", String(!v));
      try {
        localStorage.setItem("mru-demo-collapsed", v ? "1" : "0");
      } catch (e) {}
    }
    setFold(collapsed);

    el.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var a = b.getAttribute("data-demo");
      var preset = b.getAttribute("data-preset");
      if (preset) {
        applyPresetFor(variant, store, preset);
        setUrlState(preset === "idle" ? null : preset);
        return;
      }
      if (a === "fold") setFold(!collapsed);
      else if (a === "tap") {
        store.press(1);
        store.release();
      } else if (a === "hold") {
        if (store.state.phase === "idle") store.press(1);
        else store.move(1);
      } else if (a === "next") {
        if (store.state.phase === "idle") store.press(1);
        else store.move(1);
      } else if (a === "prev") {
        if (store.state.phase === "idle") store.press(-1);
        else store.move(-1);
      } else if (a === "release") store.release();
      else if (a === "esc") store.cancel();
      else if (a === "toggle-list") {
        if (store.state.phase === "open") store.toggleList();
        else {
          store.state.note = "Toggle list works while the switcher is open (hold Ctrl first).";
          store.refresh();
        }
      } else if (a === "forget") store.forgetListPref();
    });
    // Demo buttons must not steal the simulated modifier.
    el.addEventListener("mousedown", function (e) {
      if (e.target.closest("button")) e.preventDefault();
    });

    return function update(s) {
      var sel = store.selectedThread();
      el.querySelector("[data-demo-readout]").textContent =
        "phase=" +
        s.phase +
        "  selected=" +
        (s.phase === "idle" ? "-" : s.selected + 1 + "/" + s.mru.length) +
        "  active=" +
        s.activeId +
        "  last=" +
        s.lastEvent +
        (s.phase !== "idle" && sel ? "  \u2192 " + sel.id : "") +
        (store.hasListToggle
          ? "\nlist=" +
            (s.listCollapsed ? "pill" : "expanded") +
            "  saved(localStorage " +
            store.listPrefKey +
            ")=" +
            (store.savedListPref() || "none")
          : "");
      var note = el.querySelector("[data-demo-note]");
      note.hidden = !s.note;
      note.textContent = s.note || "";
    };
  }

  function setUrlState(state) {
    try {
      var params = new URLSearchParams(location.search);
      if (state) params.set("state", state);
      else params.delete("state");
      var q = params.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
    } catch (e) {}
    if (global.DesignSelector && global.DesignSelector.refresh) global.DesignSelector.refresh();
  }

  /* ---------- mount ---------- */

  function mount(variant) {
    var store = M.createStore(variant.storeOptions);
    var states = variant.states || M.STATES;
    var params = new URLSearchParams(location.search);
    var root = document.getElementById("t3-app");
    root.className = "t3-app v-" + variant.number;
    root.innerHTML =
      '<div class="t3-window">' +
      '<aside class="t3-sidebar" data-sidebar></aside>' +
      '<main class="t3-main" data-main></main>' +
      "</div>" +
      '<div class="mru-layer" data-mru-layer></div>';
    var sidebar = root.querySelector("[data-sidebar]");
    var main = root.querySelector("[data-main]");
    var layer = root.querySelector("[data-mru-layer]");
    var updateDemo = params.get("demo") === "0" ? function () {} : buildDemo(store, variant);
    var mainKey = "";

    function makeCtx() {
      var s = store.state;
      var mruThreads = store.mruThreads();
      var ctx = {
        s: s,
        store: store,
        ui: UI,
        mruThreads: mruThreads,
        selected: s.selected,
        open: s.phase === "open",
        mruIndex: function (id) {
          return s.mru.indexOf(id);
        },
      };
      ctx.decorate = function (t) {
        return (variant.decorateRow && variant.decorateRow(t, ctx)) || {};
      };
      ctx.reveal = function (t) {
        return !!(variant.revealRow && variant.revealRow(t, ctx));
      };
      ctx.sidebarTop = variant.sidebarTop ? variant.sidebarTop(ctx) : null;
      return ctx;
    }

    function render() {
      var s = store.state;
      var ctx = makeCtx();
      root.dataset.collapsed = String(s.collapsed);
      root.dataset.phase = s.phase;
      sidebar.innerHTML = renderSidebar(ctx);
      var key = s.activeId + "|" + s.collapsed + "|" + s.dataset;
      if (key !== mainKey) {
        main.innerHTML = renderMain(ctx);
        mainKey = key;
      }
      layer.dataset.phase = s.phase;
      layer.dataset.instant = String(!!s.instant);
      layer.classList.toggle("is-entering", !!s.justOpened);
      layer.innerHTML = variant.renderOverlay ? variant.renderOverlay(ctx) : "";
      if (variant.afterRender) variant.afterRender(layer, ctx, root);
      updateDemo(s);
    }

    store.subscribe(render);

    // The list/pill toggle acts on mousedown: the switcher lives only while Ctrl
    // is held, and on macOS Ctrl+click becomes a context-menu click.
    root.addEventListener("mousedown", function (e) {
      var toggle = e.target.closest("[data-mru-toggle]");
      if (!toggle) return;
      e.preventDefault();
      if (e.button === 0) store.toggleList();
    });
    root.addEventListener("contextmenu", function (e) {
      if (store.state.phase !== "idle") e.preventDefault();
    });
    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-mru-toggle]")) return;
      var commit = e.target.closest("[data-mru-commit]");
      if (commit) {
        store.commitId(commit.getAttribute("data-mru-commit"), "click-commit");
        return;
      }
      var action = e.target.closest("[data-action]");
      if (action && action.getAttribute("data-action") === "toggle-sidebar") {
        store.toggleCollapsed();
        return;
      }
      if (action && action.getAttribute("data-action") === "mru-cancel") {
        store.cancel();
        return;
      }
      var row = e.target.closest("[data-thread-id]");
      if (row) store.commitId(row.getAttribute("data-thread-id"), "sidebar-click");
    });
    // Hover selects only after the pointer really moves: a list that appears
    // under a resting cursor must not steal the keyboard selection.
    var lastPointer = null;
    root.addEventListener("mousemove", function (e) {
      var moved = lastPointer && (lastPointer.x !== e.screenX || lastPointer.y !== e.screenY);
      lastPointer = { x: e.screenX, y: e.screenY };
      if (!moved || store.state.phase !== "open") return;
      var h = e.target.closest("[data-mru-index]");
      if (!h) return;
      var i = Number(h.getAttribute("data-mru-index"));
      if (i !== store.state.selected) store.setSelected(i);
    });

    M.installKeyboard(store);

    var initial = params.get("state");
    if (initial && states.indexOf(initial) !== -1) applyPresetFor(variant, store, initial);
    else render();

    global.mruStore = store;
    return store;
  }

  global.T3Replica = { mount: mount, ui: UI };
})(window);
