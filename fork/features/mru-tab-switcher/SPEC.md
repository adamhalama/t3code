# Recent thread switcher (Ctrl+Tab)

Status: design chosen (C4, sidebar-header popover). See `DESIGN.md`; all candidate designs are at https://adamhalama.github.io/t3code/mru-tab-switcher/ (source on the `gh-pages` branch).

## Goal

Switch between recently used threads the way VS Code switches between recent editor tabs.

## Behaviour

- The switcher orders threads by when they were last opened, most recent first. The current thread is always first.
- A thread drops out of the list once you left it longer ago than the timeout: 30 minutes by default, set in Settings → General (15 min, 30 min, 1 h, 2 h or Never). The thread you came from always stays, so a tap always goes back.
- **Tap** Ctrl+Tab (press and release Ctrl quickly): open the previously opened thread at once. No picker is shown. Tapping again returns to the first thread.
- **Hold** Ctrl and press Tab: a picker opens with the second thread selected.
  - Tab moves the selection down, Shift+Tab moves it up. Both wrap around.
  - Releasing Ctrl opens the selected thread.
  - Esc closes the picker without switching.
  - Clicking a row opens that thread.
- The picker appears only if Ctrl is still held after a short delay (about 150 ms), so a quick tap never flashes it.
- While the switcher is open, the target thread is also highlighted in the sidebar (see `DESIGN.md`).
- Ctrl+L, or clicking the header chip, collapses or expands the list. The choice is remembered.
- Each row shows the thread title and its project. It also shows thread status where T3 already shows it in the sidebar: running, waiting for approval, unread, error.
- With only one thread in the list, Ctrl+Tab does nothing.
- Unsent drafts follow the same recency and timeout rules and show their composer preview. Sending the first message replaces the draft with the resulting thread without changing its position or recency. Discarded drafts and deleted or archived threads are left out.

## Keybinding

- New command `thread.recent.next` with the default key `ctrl+tab`, and `thread.recent.previous` with `ctrl+shift+tab`.
- On macOS the default is also `ctrl+tab`, not Cmd+Tab, which macOS reserves.
- Users can rebind the commands in `keybindings.json` and in the keybindings settings, like any other command.

## Scope

- Supported in the desktop app. In a normal browser tab the browser keeps Ctrl+Tab for itself, so users must rebind the command there.
- The recent list is kept in memory per window, keyed by environment and thread ID for server threads or by draft ID for unsent drafts. It starts empty on every app start or reload and is not synced through the server. The timeout and the folded-list choice are kept in local storage.
- No changes on mobile.
