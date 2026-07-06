import { describe, expect, it } from 'vitest';
import { EventBus } from './EventBus';

interface TestEvents extends Record<string, unknown> {
  scored: { points: number };
  reset: null;
}

describe('EventBus', () => {
  it('delivers payloads to subscribed handlers', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('scored', ({ points }) => received.push(points));
    bus.emit('scored', { points: 7 });
    expect(received).toEqual([7]);
  });

  it('supports multiple handlers per event', () => {
    const bus = new EventBus<TestEvents>();
    let calls = 0;
    bus.on('reset', () => calls++);
    bus.on('reset', () => calls++);
    bus.emit('reset', null);
    expect(calls).toBe(2);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<TestEvents>();
    let calls = 0;
    const unsubscribe = bus.on('reset', () => calls++);
    unsubscribe();
    bus.emit('reset', null);
    expect(calls).toBe(0);
  });

  it('ignores emits with no subscribers', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('scored', { points: 1 })).not.toThrow();
  });
});
