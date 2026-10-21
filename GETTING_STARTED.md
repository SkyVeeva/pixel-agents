# Getting Started — Pixel Agents (Claude ecosystem build)

Run a pixel-art office where **every Claude agent on your machine** shows up as an
animated character: Claude Code in your terminal, Claude Code in VS Code, the
**Claude desktop app**, and **Claude Cowork** sessions — all in one window.

This guide starts from a fresh clone and gets you to a running office with live
characters. The fastest path is the **standalone server** (a local web app); the
VS Code extension is covered afterward.

---

## 1. Prerequisites

- **Node.js ≥ 20** (`node -v` — this build is developed on 24).
- **Claude Code** installed and usable as `claude` in your terminal, and/or the
  **Claude desktop app** (the "Code" and "Cowork" tabs).
- macOS, Linux, or Windows. (Deep-link "click a character to focus it" is best on
  macOS/the desktop app; see step 6.)

No global installs are required — everything runs from the repo.

---

## 2. Install & build

From the repo root:

```bash
npm install        # installs root + all workspaces in one shot
npm run build      # asyncapi codegen → typecheck → lint → bundle CLI + webview
```

`npm run build` produces everything the server serves, under `dist/`:

- `dist/cli.js` — the standalone server (also the `pixel-agents` bin)
- `dist/webview/` — the office UI (SPA)
- `dist/assets/` — sprites, furniture, layout
- `dist/hooks/claude-hook.js` — the Claude Code hook script (auto-installed on first run)

> If `npm install` looks like it "did nothing" for `webview-ui/` — that's expected.
> It's an npm workspace; the single root install covers it.

---

## 3. Run the office

```bash
node dist/cli.js --port 3100
```

Your default browser opens the office (pass `--no-open` to just print the URL).
Running the command again while it's up reuses that server instead of starting
a second one.

- `--port` is optional; without it the server picks a random free port (handy for
  running several at once). Pin `3100` so the URL is predictable.
- The chosen port + PID are written to `~/.pixel-agents/server.json`.
- The first time, the office asks for your OK before installing the Claude Code
  hook into `~/.claude/settings.json`; after that it is re-ensured on every start
  (unless you turn hooks off in Settings, or pass `--no-hooks` for one run). This
  is what gives instant, reliable status for terminal + desktop sessions. It's
  atomic and preserves any hooks you already have. The startup output has a
  `Live Claude activity:` line saying which mode you're in.

You should see an empty office. Now let's populate it.

---

## 4. Make agents appear

Characters come from three kinds of Claude sessions. Each has its own switch.

### a) Terminal / VS Code / desktop-app sessions — automatic

These are ordinary Claude Code sessions (the desktop app's **Code** tab is one
too). With hooks installed (step 3), they appear the moment they start.

- In **another terminal**, `cd` into the same folder you launched the server from
  and run `claude`. Ask it to do something tool-heavy (read a file, run a command).
  A character walks to a desk and animates. Title + folder show on hover.
- Sessions in **other folders** don't show by default. Open **Settings** (top
  toolbar) → enable **Watch All Sessions** to adopt every active Claude session on
  the machine, regardless of directory.

### b) Claude Cowork sessions — one toggle

Cowork sessions live in the desktop app's **Cowork** tab. They never fire
hooks (they run in a private sandbox), so they're discovered by watching the
filesystem, behind an explicit switch:

1. Open **Settings** → enable **Watch Cowork Sessions**.
2. Start (or already have) a Cowork session in Claude.app doing some work.

Within a few seconds a character appears, labeled **`Cowork · <session title>`**,
animating with the session's tool activity. Archive the session in Claude.app and
the character despawns on its own. Turn the toggle back off and all Cowork
characters leave at once.

### c) Launching new sessions

In the **VS Code extension** (step 7), the **+ Agent** button opens a fresh Claude
Code session in a new terminal and adopts it. In the **standalone server** there's
no terminal to own, so just start `claude` yourself (step 4a) — it appears
automatically via hooks.

---

## 5. What the character shows

- **Animation** — typing vs reading, based on the active tool.
- **Hover / select** — a label with the current activity and a secondary line:
  the **session title** when known (e.g. `Cowork · Precision deck`), otherwise the
  workspace folder.
- **Speech bubbles** — amber "…" when a permission prompt is waiting; a green
  check when the turn finishes (with a chime if sound is on).
- **Debug View** (Settings → Debug View) — per-agent surface, title, JSONL
  connection state, and tool history.

---

## 6. Click a character to focus its session

Clicking a character with no local terminal (a desktop-app or Cowork session)
fronts it in Claude.app:

- **Desktop-app session** → opens that exact session via `claude://resume`.
- **Cowork session** → Claude.app comes to the foreground (Cowork has no
  per-session deep link, so this is the honest best-effort).

This uses the OS URL handler / app activation and is best-effort — a click never
blocks or crashes the office.

---

## 7. Alternative: the VS Code extension

Same office, hosted inside VS Code instead of a browser.

```bash
npm run build      # if you haven't already
```

Then press **F5** in VS Code (with this repo open) to launch the **Extension
Development Host**. In that window, open the **Pixel Agents** panel. The same
Settings toggles apply (**Watch All Sessions**, **Watch Cowork Sessions**,
**Instant Detection (Hooks)**). Terminals you open _inside_ that window are
adopted automatically.

The standalone server and the VS Code extension keep separate state
(`~/.pixel-agents/standalone-state.json` vs `vscode-state.json`) and never clobber
each other, so you can run both at once.

---

## 8. Everyday commands

```bash
npm run build          # full production-ish build (what step 2 runs)
npm run watch          # rebuild CLI on change (run the server yourself after)
cd webview-ui && npm run dev   # separate terminal: live-reload the UI during dev

npm test               # webview + server unit/integration tests
npm run test:server    # just the server suite (Vitest)
npm run e2e -- --workers=1 --grep "cowork"   # a focused e2e slice
```

For UI-only iteration, `cd webview-ui && npm run dev` runs the Vite dev server
with a browser mock (no backend needed). To exercise the real server + UI
together, re-run `npm run build` and reload http://127.0.0.1:3100.

---

## 9. Where state lives

| Path                                             | What                                                    |
| ------------------------------------------------ | ------------------------------------------------------- |
| `~/.pixel-agents/config.json`                    | Settings (sound, Watch All, **Watch Cowork**, hooks, …) |
| `~/.pixel-agents/layout.json`                    | Your office layout (shared across surfaces)             |
| `~/.pixel-agents/server.json`                    | Running server's `{ port, pid, authToken }`             |
| `~/.pixel-agents/hooks/claude-hook.js`           | The installed Claude Code hook                          |
| `~/.claude/settings.json`                        | Where the hook is registered (auto-managed)             |
| `~/.claude/projects/<hash>/<id>.jsonl`           | Claude Code + desktop-app session transcripts           |
| `~/Library/Application Support/Claude/…` (macOS) | Desktop + Cowork session metadata + Cowork transcripts  |

Nothing here is destructive to reset — delete `~/.pixel-agents/` to start clean
(the office rebuilds a default layout on next launch).

---

## 10. Troubleshooting

- **No characters, terminal sessions running.** Check hooks are on
  (Settings → _Instant Detection (Hooks)_), and that the session's folder matches
  the server's launch folder — otherwise enable **Watch All Sessions**.
- **Cowork sessions not showing.** Enable **Watch Cowork Sessions**. Cowork is
  discovered on a filesystem scan tick, so give it a few seconds; the session must
  be recently active (its transcript is >3 KB and touched in the last ~10 min).
- **Nothing at the URL.** Confirm the server printed
  `Pixel Agents server running at http://127.0.0.1:3100` and that
  `~/.pixel-agents/server.json` shows that port. If you omitted `--port`, the port
  is random — read it from `server.json`.
- **Clicking a character does nothing.** For terminal-less sessions the click
  tries to front Claude.app; if the app isn't installed/running there's nothing to
  focus. This is expected and never errors.
- **Rebuild after pulling changes.** Re-run `npm run build` — the browser serves
  the last `dist/` build, not your source.

---

Built on the fork-first `feature/claude-ecosystem` branch. The full design and the
verified Claude.app internals are in
`docs/superpowers/specs/2026-07-17-claude-ecosystem-design.md`.
