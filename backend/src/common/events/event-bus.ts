import { Injectable } from '@nestjs/common';
import { DomainEvent } from './domain-event';

type EventHandler = (event: DomainEvent) => Promise<void>;

@Injectable()
export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventName: string, handler: EventHandler) {
    const handlers = this.handlers.get(eventName) || [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.name) || [];
    await Promise.all(
      handlers.map((h) =>
        h(event).catch((err) =>
          console.error(`EventBus: handler failed for ${event.name}:`, err),
        ),
      ),
    );
  }
}
