# Pixel Agents → Claude Ecosystem (Cowork + Claude Code Desktop)

## Context

Pixel-agents visualizes **Claude Code CLI/VS Code terminal sessions** as pixel-art office characters via hook events + JSONL transcript watching under `~/.claude/projects/`. Goal: extend it so **Claude Cowork** and **Claude Code desktop app** sessions also appear in the office — every Claude agent on the machine, one office.

Decisions made with the user:

- **Depth**: observe + focus — characters mirror sessions (title, status, activity); clicking deep-links into Claude.app.
- **Scope**: both surfaces, one milestone.
- **Packaging**: fork/experiment first (user is not an upstream committer); design stays upstream-compatible (AsyncAPI contract + regen, constants policy, e2e normative rules, strict layering).
- **First step**: working spike proving riskiest assumptions.

## Ground truth (recon on this machine, 2026-07-17)

**Desktop app** (Claude.app → Code tab): sessions are ordinary Claude Code sessions — transcripts in `~/.claude/projects/`, global hooks fire. Proof: this very session is already tracked by the running pixel-agents standalone server. Metadata sidecar: `~/Library/Application Support/Claude/claude-code-sessions/<acct>/<user>/local_<uuid>.json` with `title`, `cliSessionId` (join key, verified), `cwd`, `isArchived`, `lastFocusedAt`, `model`.

**Cowork** (Claude.app → Cowork tab): per-session dir `~/Library/Application Support/Claude/local-agent-mode-sessions/<acct>/<user>/local_<uuid>/` containing a **private `.claude` home** whose `.claude/projects/<hash>/<cliSessionId>.jsonl` is **schema-identical** to Claude Code transcripts (verified). No `settings.json` inside → **hooks never fire for Cowork**; file-watching is the only signal — this is why Cowork is invisible today. Sibling `local_<uuid>.json` metadata: `title`, `cwd` (= `<sessionDir>/outputs`), `cliSessionId`, `userSelectedFolders`, `isArchived`, `lastActivityAt`, `vmProcessName`, `egressAllowedDomains`. Plus `spaces.json` (named spaces → future "areas" mapping) and `audit.jsonl`.

**Focus deep link**: Claude.app registers `claude://`; its bundle contains a `claude://resume` route with `searchParams.get("session")` and error toasts for missing CLI transcripts → almost certainly `claude://resume?session=<cliSessionId>`. Exact shape + Cowork behavior = Phase 0 spike; fallback `open -a Claude`.

All of this is undocumented internals (docs research confirmed) → defensive parsing, graceful absence, centralized paths.

## Repo seams (explored, file:line verified at HEAD cd0343b)

**Already fits:**

- `scanGlobalProjectDirs` ([fileWatcher.ts:1194](server/src/fileWatcher.ts)) calls `provider.getAllSessionRoots()` **fresh every 3s tick** whenever its gate is on, even in hooks mode; walks root → project dirs → `.jsonl` (>3KB, <10min old). Dynamic Cowork roots need no scanner rework.
- `transcriptParser.ts` works unchanged (same JSONL schema).
- External/no-terminal/arbitrary-cwd agents fully supported (`isExternal: true`, no `terminalRef`).
- e2e mock runner **already supports** `transcriptPathTemplate`, `sidecarPathTemplate`/`sidecarJson`, timed `writeJson`/`deletePath` ([e2e/helpers/mock-claude.ts:14-60](e2e/helpers/mock-claude.ts)) — fabricating the Application Support tree under tmpHome is a small helper, not new machinery.
- Settings-toggle pattern has 6+ precedents (`watchAllSessions`, `showAreas`, …) across ClientMessage → clientMessageHandler → configPersistence → SettingsModal.

**Gaps to close:**

1. No `sessionTitle`/`surface` fields anywhere in state/protocol/UI; Cowork labels would be garbage ("outputs") without metadata.
2. `focusAgent` is a silent no-op for terminal-less agents (VS Code [PixelAgentsViewProvider.ts:255](adapters/vscode/PixelAgentsViewProvider.ts); standalone default branch [clientMessageHandler.ts:176](server/src/clientMessageHandler.ts)).
3. Lifecycle: 30s stale check is deletion-only and skipped in hooks mode → Cowork characters would linger; metadata must drive removal.
4. **Bug-in-waiting**: `setWatchAllSessions` OFF cleanup ([PixelAgentsViewProvider.ts:330-351](adapters/vscode/PixelAgentsViewProvider.ts)) removes every external agent outside the workspace — would nuke Cowork agents. Must skip `surface === 'cowork'`.
5. Don't build multi-provider dispatch: runtime is structurally single-provider (`handleEvent` ignores providerId, [hookEventHandler.ts:131](server/src/hookEventHandler.ts)); Cowork never fires hooks so a second HookProvider would be ~90% dead interface.
6. asyncapi `AgentCreated` already drifted vs code (team/hooksOnly fields undocumented) — repair first.

## Architecture decisions

1. **Discovery**: new optional provider member `getAuxiliarySessionRoots?(): string[]` in [core/src/provider.ts](core/src/provider.ts); Claude impl returns each live Cowork `local_<uuid>/.claude/projects`. Separate member (not appended to `getAllSessionRoots`) so gating stays independent of `watchAllSessions`.
2. **Metadata**: new optional provider extension `sessionIndex?: SessionIndexProvider` (mirrors the `team?: TeamProvider` precedent) in new `core/src/sessionIndexProvider.ts` — `listSessions(): {sessionId, info: {surface, title?, isArchived, externalRef?, transcriptDirPrefix?}}[]`. Claude impl `claudeSessionIndex.ts` reads both metadata families defensively. `AgentRuntime` polls it (`SESSION_INDEX_POLL_INTERVAL_MS = 5000`), joins **by `sessionId === cliSessionId`** (works for every adoption path) with Cowork path-prefix fallback, broadcasts changes, applies lifecycle. Plus adoption-time enrichment via a `setSessionInfoResolver` module hook (follows `setFolderNameResolver` precedent) so labels are right from the first frame.
3. **Gating**: dedicated `watchCoworkSessions` toggle (default OFF upstream; flip on fork if desired). Desktop-title enrichment needs no toggle (no new characters). Toggle-OFF → `removeAgentsBySurface('cowork')`.
4. **Protocol** (asyncapi + regen, `additionalProperties: false` kept): commit 1 = AgentCreated drift repair (add the 5 already-sent optional fields); then `AgentCreated` + `ExistingAgents` gain `sessionTitle`/`surface` (+ Record maps), new ServerMessage `agentSessionInfo {id, title?, surface?}` (modeled on `agentTeamInfo`), new ClientMessage `setWatchCoworkSessions`, `settingsLoaded.watchCoworkSessions`. `surface` stays `string` (no enums in webview).
5. **Focus**: provider-owned `buildFocusUri()` (`claudeAppFocus.ts`) + generic per-platform launcher `server/src/appFocus.ts` (`open`/`start`/`xdg-open`, injectable spawn). Standalone gets an explicit `focusAgent` case; VS Code extends its branch chain after terminalRef/lead. `buildFocusUri` null → `activateApp('Claude')` — click always does something.
6. **Lifecycle**: leave the stale check alone; the session-index poller (runs in both modes) removes on `isArchived` or metadata/dir disappearance, and the scanner consults the resolver to **skip archived sessions at adoption** (avoids re-adopt/remove flicker).

## Implementation phases

**Phase 0 — Spike (no repo changes; scratchpad scripts + throwaway branch)**

- Dump/verify both metadata trees (field names, account/user nesting, join cardinality vs live transcripts).
- Deep-link probe: live-test `open "claude://resume?session=<cliSessionId>"` on a desktop session, a Cowork session, and with the app quit. Record exact shape.
- Throwaway branch pointing aux roots at one live Cowork `.claude/projects` → confirm adoption, animation, parser compat end-to-end.
- Exit: confirmed metadata fields; confirmed/rejected deep-link shape; chosen Cowork focus param.

**Phase 1 — Protocol + state plumbing (no behavior change)**

- `core/asyncapi.yaml` (drift repair commit, then new fields/messages) + regen `core/src/messages.ts`.
- Thread `sessionTitle?`/`surface?`: [server/src/types.ts](server/src/types.ts), [core/src/schemas.ts](core/src/schemas.ts) (both PersistedAgent shapes), `agentStateStore.persist()`, `restoreExternalAgents()`, both `agentCreated` senders ([httpServer.ts:159](server/src/httpServer.ts), [PixelAgentsViewProvider.ts:106](adapters/vscode/PixelAgentsViewProvider.ts)), both `existingAgents` senders (clientMessageHandler.ts:263, agentManager.ts sendExistingAgents ~:505).
- Webview: `Character` fields ([office/types.ts](webview-ui/src/office/types.ts)), `officeState.setSessionInfo()` (mirrors `setTeamInfo`), `useExtensionMessages` handlers incl. `pendingAgents` buffer + new `agentSessionInfo`, ToolOverlay secondary line renders `sessionTitle ?? folderName` with surface prefix (`Cowork · <title>`) + `data-surface` attr for e2e.
- Tests: vitest persist/restore round-trip + message payloads. No e2e (nothing visible).

**Phase 2 — Cowork discovery + adoption (gated)**

- New `server/src/providers/hook/claude/claudeSurfacePaths.ts`: `getClaudeAppSupportDir()` per-OS (darwin/win32 APPDATA/linux XDG), `listCoworkSessionDirs()`, `getCoworkAuxProjectRoots()`, `isCoworkPath()`, `getDesktopSessionMetadataRoot()` — all homedir/env-derived for tmpHome fabrication; dir-name constants in provider constants.ts.
- `getAuxiliarySessionRoots?()` in core + claude impl; `startExternalSessionScanning` gains `watchCoworkSessionsRef`, tick fires global scan when `watchAll || cowork` with per-root-set flags; `adoptExternalSession` gains optional `surface` param.
- Setting `watchCoworkSessions` end-to-end (configPersistence, clientMessageHandler, VS Code keys + handler, cli.ts startup sync, SettingsModal checkbox) + `removeAgentsBySurface` + **the watchAll-OFF cleanup fix**.
- Tests: vitest (paths fixture tree, config key, toggle behavior); e2e standalone: scenario appends JSONL into fabricated Cowork tree, toggle on via Settings, assert character + activity overlay, toggle off → despawn. Budget 3s scanner tick + 3KB min size.

**Phase 3 — Session metadata index: titles, desktop enrichment, lifecycle**

- `core/src/sessionIndexProvider.ts`, `sessionIndex?` member, `claudeSessionIndex.ts` (both families, defensive parsing per `parseAreaMappings` precedent), `setSessionInfoResolver` in fileWatcher (consulted at all adoption points + archived-skip gate), `AgentRuntime.startSessionIndexPolling()` (join → mutate → broadcast `agentSessionInfo` → removals), constant 5000ms, both hosts start it.
- Tests: vitest (parsing fixtures: multi-account, malformed → skip, never remove on parse error; poller with fake index: join/title-update/archive-removal/adoption-gate); e2e: title on overlay, timed `writeJson` rename → label updates, `isArchived: true` → despawn, desktop sidecar keyed to hooks-on scenario → title appears.

**Phase 4 — Focus**

- `claudeAppFocus.ts` (`buildFocusUri` per spike result), `server/src/appFocus.ts` (per-platform openUri/activateApp, injectable spawn, constants), standalone `focusAgent` case, VS Code surface branch.
- Tests: vitest (URI construction, platform command selection, dispatch); e2e: app launch untestable in CI → README "not covered" row + manual smoke bullet; click-does-not-crash assertion.

**Phase 5 — Docs + polish**

- CLAUDE.md updates (new provider members, setting, message counts — also fix stale "5 toggles"), `npm run e2e:inventory` regen, DebugView shows surface/title, CHANGELOG.

**Out of scope (documented as future work):** remote/cloud desktop sessions (no local footprint), steering/prompt-sending (deep-link `prompt` param exists — noted), Cowork spaces → office areas mapping (areaMappings exists), audit.jsonl as alternate stream, true multi-provider registry (upstream discussion).

## Verification

- **Phase 0 is itself verification** (live Cowork session animates on throwaway branch; deep-link observed fronting a session).
- Per phase: `npm run compile` (types + lint + asyncapi drift), `npm test`, new vitest suites, targeted `npm run e2e -- --grep <new specs>` (`--workers=1` to match CI).
- End-to-end manual: run `npx pixel-agents` with `watchCoworkSessions` on while a real Cowork session works → character appears with real title + Cowork badge, animates with tool activity; archive the session in Claude.app → character despawns; click a desktop-session character → Claude.app fronts that session.
- Regression: existing 47 e2e tests stay green; VS Code surface unaffected with toggle off.

## Post-approval bookkeeping (first execution steps)

1. Write onboarding memory files (project context, Claude.app internals ground truth, repo seams) to the persistent memory directory + MEMORY.md index.
2. Commit this design as `docs/superpowers/specs/2026-07-17-claude-ecosystem-design.md` on a new branch (e.g. `feature/claude-ecosystem`).
3. Run Phase 0 spike; feed results back into the design before Phase 1.
