import { afterEach, describe, expect, it } from 'vitest';

import type {
  SessionIndexEntry,
  SessionIndexProvider,
} from '../../core/src/sessionIndexProvider.js';
import { AgentRuntime } from '../src/agentRuntime.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import type { AgentState } from '../src/types.js';

/** A HookProvider identical to Claude's but with a controllable session index. */
function providerWithIndex(entries: () => SessionIndexEntry[]): typeof claudeProvider {
  const sessionIndex: SessionIndexProvider = { listSessions: () => entries() };
  return { ...claudeProvider, sessionIndex };
}

function seedAgent(store: AgentStateStore, id: number, overrides: Partial<AgentState> = {}): void {
  store.set(id, {
    id,
    sessionId: `cli-${id}`,
    isExternal: true,
    projectDir: `/proj-${id}`,
    jsonlFile: `/proj-${id}/cli-${id}.jsonl`,
    fileOffset: 0,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    backgroundAgentToolIds: new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    lastDataAt: 0,
    linesProcessed: 0,
    seenUnknownRecordTypes: new Set(),
    hookDelivered: false,
    contextTokens: 0,
    maxContextTokens: 200_000,
    ...overrides,
  });
}

describe('AgentRuntime -- session-index poller', () => {
  let runtime: AgentRuntime;

  afterEach(() => runtime?.dispose());

  it('enriches an agent with title + surface and broadcasts agentSessionInfo on change', () => {
    const store = new AgentStateStore();
    seedAgent(store, 1); // sessionId cli-1, no title/surface yet
    const broadcasts: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => broadcasts.push(m));

    runtime = new AgentRuntime(
      store,
      providerWithIndex(() => [
        {
          sessionId: 'cli-1',
          info: { surface: 'desktop', title: 'My session', isArchived: false },
        },
      ]),
    );
    runtime.startSessionIndexPolling(); // primes + runs one tick synchronously

    const agent = store.get(1);
    expect(agent?.sessionTitle).toBe('My session');
    expect(agent?.surface).toBe('desktop');
    const info = broadcasts.find((m) => m.type === 'agentSessionInfo');
    expect(info).toMatchObject({ id: 1, title: 'My session', surface: 'desktop' });
  });

  it('does not re-broadcast when title/surface are unchanged', () => {
    const store = new AgentStateStore();
    seedAgent(store, 1, { sessionTitle: 'Stable', surface: 'desktop' });
    const broadcasts: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => broadcasts.push(m));

    runtime = new AgentRuntime(
      store,
      providerWithIndex(() => [
        { sessionId: 'cli-1', info: { surface: 'desktop', title: 'Stable', isArchived: false } },
      ]),
    );
    runtime.startSessionIndexPolling();

    expect(broadcasts.some((m) => m.type === 'agentSessionInfo')).toBe(false);
  });

  it('removes an agent whose session is archived', () => {
    const store = new AgentStateStore();
    seedAgent(store, 1, { surface: 'cowork' });

    runtime = new AgentRuntime(
      store,
      providerWithIndex(() => [
        { sessionId: 'cli-1', info: { surface: 'cowork', title: 'Gone', isArchived: true } },
      ]),
    );
    runtime.startSessionIndexPolling();

    expect(store.has(1)).toBe(false);
  });

  it('removes a Cowork agent whose metadata disappeared, but leaves plain agents alone', () => {
    const store = new AgentStateStore();
    seedAgent(store, 1, { surface: 'cowork' }); // no matching entry -> removed
    seedAgent(store, 2, { surface: undefined }); // plain terminal session -> kept

    runtime = new AgentRuntime(
      store,
      providerWithIndex(() => []), // empty index
    );
    runtime.startSessionIndexPolling();

    expect(store.has(1)).toBe(false);
    expect(store.has(2)).toBe(true);
  });

  it('joins Cowork agents by transcript-path prefix when the id key does not match', () => {
    const store = new AgentStateStore();
    seedAgent(store, 1, {
      sessionId: 'some-other-id',
      surface: 'cowork',
      jsonlFile: '/cowork/home/.claude/projects/hash/actual.jsonl',
    });
    const broadcasts: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => broadcasts.push(m));

    runtime = new AgentRuntime(
      store,
      providerWithIndex(() => [
        {
          sessionId: 'unrelated',
          info: {
            surface: 'cowork',
            title: 'Prefix match',
            isArchived: false,
            transcriptDirPrefix: '/cowork/home/.claude/projects',
          },
        },
      ]),
    );
    runtime.startSessionIndexPolling();

    expect(store.get(1)?.sessionTitle).toBe('Prefix match');
    expect(store.has(1)).toBe(true);
    expect(broadcasts.some((m) => m.type === 'agentSessionInfo')).toBe(true);
  });
});
