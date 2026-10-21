# Product Vision — Pixel Agents

> Bootstrapped by the DISCUSS wave for feature `one-click-viewer-launch` (2026-07-17).
> This is the SSOT product vision. Extend it; do not fork it per feature.

## What it is

A pixel-art office where AI coding agents (Claude Code today, any tool tomorrow)
become animated characters. Ships as a VS Code extension and an
`npx pixel-agents` standalone browser viewer from the same source tree.

## Who it's for

Developers using Claude Code who want **ambient, at-a-glance visibility** into
what their agents are doing — without reading logs or staring at a terminal.

## The promise

Watching your agents should feel effortless and a little delightful. Setup
friction is the enemy: if seeing the office takes more than one step, the moment
of "just show me" is lost.

## Guiding principles

1. **Same protocol, many surfaces.** VS Code, browser, desktop, Cowork — one
   runtime, one contract.
2. **It just works.** Sensible defaults over flags. Degrade gracefully; never
   hard-fail a launch.
3. **Respect the user's machine.** Anything that touches `~/.claude` is
   idempotent, logged, and reversible.
