import { describe, expect, it } from 'vitest';

import { buildClaudeFocusUri } from '../src/providers/hook/claude/claudeAppFocus.js';

describe('buildClaudeFocusUri', () => {
  it('builds a resume deep link for desktop / plain sessions', () => {
    expect(buildClaudeFocusUri({ sessionId: 'abc-123', surface: 'desktop' })).toBe(
      'claude://resume?session=abc-123',
    );
    // Undefined surface = plain CLI/terminal session -> transcript is in the
    // global home, so resume works.
    expect(buildClaudeFocusUri({ sessionId: 'abc-123' })).toBe('claude://resume?session=abc-123');
  });

  it('returns null for Cowork sessions (resume fails; no per-session link exists)', () => {
    expect(buildClaudeFocusUri({ sessionId: 'abc-123', surface: 'cowork' })).toBeNull();
  });

  it('returns null when the session id is empty', () => {
    expect(buildClaudeFocusUri({ sessionId: '' })).toBeNull();
  });

  it('URI-encodes the session id', () => {
    expect(buildClaudeFocusUri({ sessionId: 'a b/c' })).toBe('claude://resume?session=a%20b%2Fc');
  });
});
