# Recent thread switcher (Ctrl+Tab)

Status: design under review. See `mocks/` for the candidate designs.

## Goal

Switch between recently used threads the way VS Code switches between recent editor tabs.

## Behaviour

- The switcher orders threads by when they were last opened, most recent first. The current thread is always first.
- **Tap** Ctrl+Tab (press and release Ctrl quickly): open the previously opened thread at once. No picker is shown. Tapping again returns to the first thread.
- **Hold** Ctrl and press Tab: a picker opens with the second thread selected.
  - Tab moves the selection down, Shift+Tab moves it up. Both wrap around.
  - Releasing Ctrl opens the selected thread.
  - Esc closes the picker without switching.
  - Clicking a row opens that thread.
- The picker appears only if Ctrl is still held after a short delay (about 150 ms), so a quick tap never flashes it.
- Each row shows the thread title and its project. It also shows thread status where T3 already shows it in the sidebar: running, waiting for approval, unread, error.
- With only one thread in the list, Ctrl+Tab does nothing.
- Threads that were deleted or archived are left out of the list.

## Keybinding

- New command `thread.recent.next` with the default key `ctrl+tab`, and `thread.recent.previous` with `ctrl+shift+tab`.
- On macOS the default is also `ctrl+tab`, not Cmd+Tab, which macOS reserves.
- Users can rebind the commands in `keybindings.json` and in the keybindings settings, like any other command.

## Scope

- Supported in the desktop app. In a normal browser tab the browser keeps Ctrl+Tab for itself, so users must rebind the command there.
- The recent list is kept per client in local storage and follows the existing thread identity (environment + thread id). It is not synced through the server.
- No changes on mobile.
