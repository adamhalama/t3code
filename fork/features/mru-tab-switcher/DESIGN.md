# Recent thread switcher: design

Chosen design: **C4, sidebar-header popover**. The mocks live on the `gh-pages` branch (`mru-tab-switcher/combined/4.html`, files `mru-tab-switcher/combined/variants/4-header-popover.*`), not in the app source.
Live mock: https://adamhalama.github.io/t3code/mru-tab-switcher/combined/4.html

## What the user sees while Ctrl is held

- **Sidebar highlight (always on).** The thread that will open is highlighted in the sidebar. Other thread rows dim. Each thread in the recent list shows its recent-order number (1, 2, 3...) in place of the time. When the selection is inside a collapsed project or section, that group shows just enough to reveal the selected thread, and the sidebar scrolls it into view.
- **Header chip.** The sidebar's Search row turns into a `Recent 2/9` chip for as long as the switcher is open.
- **List popover (expanded by default).** A compact list opens beside the chip, pointing at it. One row per recent thread: number, title, project, status icon, time. The selected row matches the sidebar selection at every step.
- **Collapsed form.** Clicking the chip, or pressing Ctrl+L, folds the list back into the chip. The chip then reads `2/9 · <selected title>`. Clicking it again, or Ctrl+L, expands the list.
- The expanded or collapsed choice is remembered in local storage for the next switch. There is no Settings entry.
- **Sidebar hidden.** If the sidebar is collapsed, a slim panel with the same highlight, chip and list slides in from the left while Ctrl is held.

## Interaction rules

- Clicking the chip or a toggle never switches threads; only releasing Ctrl does. Clicking a list row or a highlighted sidebar row opens that thread.
- Ctrl+L works only while the switcher is open. Outside the switcher it does what it did before.
- On macOS, Ctrl+click is a right-click. The switcher handles the toggle on pointer down and blocks the context menu while it is open.

## Code layout

Fork-owned code lives in new files to keep the upstream patch small. Every edit to an upstream file is marked with a `fork:` comment.

New files, all in `apps/web/src/fork/recentThreads/`:

- `recentThreadsMru.ts`: the recent list (touch, prune, display order) and its local storage.
- `recentSwitcherMachine.ts`: the idle, pending and open state machine (tap, hold, cycle, commit, cancel, fold).
- `recentThreadsStore.ts`: the zustand store, the single machine instance, and the narrow row and reveal selectors.
- `RecentThreadSwitcher.tsx`: route tracking, window key, pointer and focus listeners, desktop menu actions, and the slide-in panel.
- `RecentThreadsChip.tsx`, `RecentThreadsList.tsx`, `RecentThreadRowBadge.tsx`: the chip, popover, list rows and sidebar badge.
- Tests: `recentThreadsMru.test.ts`, `recentSwitcherMachine.test.ts`, `recentThreadsStore.test.ts`.

## Patch surface

Upstream files touched, from `git diff --numstat fork/main -- ':!fork' ':!apps/web/src/fork'`:

| File                                                            |   + |   - | Why                                                                              |
| --------------------------------------------------------------- | --: | --: | -------------------------------------------------------------------------------- |
| `packages/contracts/src/keybindings.ts`                         |   3 |   0 | `thread.recent.next` and `thread.recent.previous` commands                       |
| `packages/shared/src/keybindings.ts`                            |   3 |   0 | `ctrl+tab` and `ctrl+shift+tab` defaults                                         |
| `apps/server/src/keybindings.test.ts`                           |  17 |   0 | Existing `keybindings.json` files gain the new defaults on startup               |
| `apps/web/src/components/settings/KeybindingsSettings.logic.ts` |   3 |   0 | Settings labels                                                                  |
| `apps/web/src/components/AppSidebarLayout.tsx`                  |   2 |   0 | Mounts the switcher                                                              |
| `apps/web/src/components/Sidebar.tsx`                           |  49 |  11 | Reveals the selected thread in a closed shelf or project folder                  |
| `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`       |   4 |   1 | The chip over the Search row                                                     |
| `apps/web/src/components/sidebar/SidebarThreadRow.tsx`          |  27 |   3 | Row highlight, dimming and number badge                                          |
| `apps/web/src/components/ReopenClosedViewShortcut.tsx`          |   3 |   0 | Forwards the commands out of a focused preview                                   |
| `apps/web/src/components/files/BrowserDocumentFrame.tsx`        |   3 |   0 | Forwards the commands out of an HTML render frame                                |
| `apps/desktop/src/preview/Manager.ts`                           |   4 |   1 | Focuses the app when a preview forwards the commands, so Ctrl's release is heard |
| `docs/user/keybindings.md`                                      |  17 |   0 | User docs and the browser tab limitation                                         |

Total: 12 files, +135 / -16. The server needs no code change: startup already adds missing default keybindings to an existing `keybindings.json`.

## Known limitations

- Browsers keep Ctrl+Tab for their own tabs, so the default binding works only in the desktop app. Rebind the commands to use the switcher in a browser tab.
- Inside the embedded preview, the switcher learns which modifier to watch from the first effective binding of the command, because the preview forwards only the command name. If the same command is bound twice with different modifiers (for example `ctrl+tab` and `alt+q`), holding the other chord from inside the preview commits on the first key up. Fixing it means forwarding the pressed modifiers from `apps/desktop/src/preview/Manager.ts` and the preview frame.
