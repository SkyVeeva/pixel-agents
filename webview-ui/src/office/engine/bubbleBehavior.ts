import type { Character } from '../types.js';

/**
 * A "waiting" bubble is persistent — always full alpha, never auto-expires —
 * only when it represents the agent waiting on the USER (awaitingInput). The
 * turn-finished "Done" waiting bubble is transient: it counts down and fades.
 * Permission bubbles have their own (already-persistent) handling and are not
 * "waiting", so they return false here.
 *
 * Single source of truth so the renderer (alpha + whether to draw) and the
 * update loop (whether to run the expiry countdown) can never diverge.
 */
export function isPersistentWaitingBubble(
  bubbleType: Character['bubbleType'],
  waitingAwaitingInput: boolean | undefined,
): boolean {
  return bubbleType === 'waiting' && waitingAwaitingInput === true;
}
