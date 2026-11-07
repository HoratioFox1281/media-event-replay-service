import assert from "node:assert/strict";
import test from "node:test";
import { selectMissedEvents, type MediaEvent } from "../src/media_replay.js";

test("replays only undelivered media events inside the recovery window", () => {
  const events: MediaEvent[] = [
    {
      kind: "asset.ingested",
      event_id: "evt_old",
      occurred_at: "2026-09-18T08:59:00.000Z",
      delivered: false,
      asset_id: "asset_1",
      creator_id: "creator_1",
      source_name: "trailer.mov"
    },
    {
      kind: "processing.completed",
      event_id: "evt_done",
      occurred_at: "2026-09-18T09:04:00.000Z",
      delivered: true,
      asset_id: "asset_1",
      job_id: "job_1",
      rendition: "1080p"
    },
    {
      kind: "creator.delivery.ready",
      event_id: "evt_replay",
      occurred_at: "2026-09-18T09:05:00.000Z",
      delivered: false,
      asset_id: "asset_1",
      creator_id: "creator_1",
      download_path: "/creators/creator_1/assets/asset_1"
    },
    {
      kind: "creator.delivery.ready",
      event_id: "evt_replay",
      occurred_at: "2026-09-18T09:02:00.000Z",
      delivered: false,
      asset_id: "asset_1",
      creator_id: "creator_1",
      download_path: "/creators/creator_1/assets/older"
    }
  ];

  const selected = selectMissedEvents(events, "2026-09-18T09:00:00.000Z");
  assert.deepEqual(selected.map((event) => event.event_id), ["evt_replay"]);
  const replayEvent = selected[0];
  assert.equal(replayEvent?.kind, "creator.delivery.ready");
  if (replayEvent?.kind === "creator.delivery.ready") {
    assert.equal(replayEvent.download_path, "/creators/creator_1/assets/asset_1");
  }
});
