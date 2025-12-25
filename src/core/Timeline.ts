import type {
  TimelineActionHandlers,
  TimelineConfig,
  TimelineEvent,
} from "@/core/types";

type TimelineEventTriggeredDetail = {
  event: TimelineEvent;
};

export class Timeline extends EventTarget {
  private readonly config: TimelineConfig;
  private readonly handlers: Partial<TimelineActionHandlers>;
  private clockStart = 0;
  private cursor = 0;
  private playing = false;
  private currentTime = 0;

  constructor(config: TimelineConfig, handlers: Partial<TimelineActionHandlers> = {}) {
    super();
    this.config = {
      ...config,
      events: [...config.events].sort((a, b) => a.time - b.time),
    };
    this.handlers = handlers;
  }

  start(startAt = 0): void {
    this.playing = true;
    this.cursor = 0;
    this.clockStart = performance.now() / 1000 - startAt;
    this.currentTime = startAt;
  }

  stop(): void {
    this.playing = false;
  }

  reset(): void {
    this.cursor = 0;
    this.currentTime = 0;
  }

  updateHandlers(handlers: Partial<TimelineActionHandlers>): void {
    Object.assign(this.handlers, handlers);
  }

  tick(): void {
    if (!this.playing) {
      return;
    }
    const now = performance.now() / 1000;
    this.currentTime = now - this.clockStart;
    this.dispatchEvents();
    if (this.currentTime >= this.config.duration) {
      this.stop();
      this.dispatchEvent(new Event("completed"));
    }
  }

  advanceTo(time: number): void {
    this.currentTime = time;
    this.dispatchEvents();
  }

  getTime(): number {
    return this.currentTime;
  }

  private dispatchEvents(): void {
    while (
      this.cursor < this.config.events.length &&
      this.config.events[this.cursor].time <= this.currentTime
    ) {
      const event = this.config.events[this.cursor];
      this.execute(event);
      this.dispatchEvent(new CustomEvent<TimelineEventTriggeredDetail>("event", { detail: { event } }));
      this.cursor += 1;
    }
  }

  private execute(event: TimelineEvent): void {
    const handler = this.handlers[event.action];
    if (handler) {
      handler(event.params);
    }
  }
}
