export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof EventMap, Set<(payload: unknown) => void>>();

  on<Name extends keyof EventMap>(
    name: Name,
    handler: (payload: EventMap[Name]) => void,
  ): () => void {
    let subscribers = this.handlers.get(name);
    if (!subscribers) {
      subscribers = new Set();
      this.handlers.set(name, subscribers);
    }
    const untyped = handler as (payload: unknown) => void;
    subscribers.add(untyped);
    return () => subscribers.delete(untyped);
  }

  emit<Name extends keyof EventMap>(name: Name, payload: EventMap[Name]): void {
    this.handlers.get(name)?.forEach((handler) => handler(payload));
  }
}
