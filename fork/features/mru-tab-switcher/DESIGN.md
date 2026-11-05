# Recent thread switcher: design

Chosen design: **C4, sidebar-header popover** (`mocks/combined/4.html`, files `mocks/combined/variants/4-header-popover.*`).
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

Fork-owned code lives in new files to keep the upstream patch small. Every edit to an upstream file is marked with a `fork:` comment. See the "Patch surface" section of the PR or `git diff fork/main -- ':!fork' ':!apps/web/src/fork'` for the exact list.
