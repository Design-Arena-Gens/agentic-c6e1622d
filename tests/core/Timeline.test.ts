import { describe, expect, it, vi } from "vitest";
import { Timeline } from "@/core/Timeline";
import type { TimelineConfig } from "@/core/types";

const config: TimelineConfig = {
  duration: 10,
  events: [
    { time: 1, action: "audio.play", params: { clip: "intro" } },
    { time: 2, action: "splats.explode", params: { material: "smoke", origin: [0, 0, 0], force: 5 } },
  ],
};

describe("Timeline", () => {
  it("invokes handlers in chronological order", () => {
    const timeline = new Timeline(config);
    const handler = vi.fn();
    timeline.updateHandlers({
      "audio.play": handler,
      "splats.explode": handler,
    });
    timeline.start(0);
    timeline.advanceTo(2.1);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0]).toEqual({ clip: "intro" });
    expect(handler.mock.calls[1][0]).toEqual({ material: "smoke", origin: [0, 0, 0], force: 5 });
  });
});
