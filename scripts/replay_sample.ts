export {};

const response = await fetch("http://localhost:3000/replays", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    webhook_id: "wh_media_creator_events",
    creator_endpoint: "https://creator.example.com/platform-events",
    missed_since: "2026-09-18T09:00:00.000Z",
    events: [
      {
        kind: "asset.ingested",
        event_id: "evt_asset_2048",
        occurred_at: "2026-09-18T09:03:00.000Z",
        delivered: false,
        asset_id: "asset_2048",
        creator_id: "creator_88",
        source_name: "launch-cut.mov"
      },
      {
        kind: "processing.completed",
        event_id: "evt_job_730",
        occurred_at: "2026-09-18T09:08:00.000Z",
        delivered: false,
        asset_id: "asset_2048",
        job_id: "job_730",
        rendition: "1080p"
      }
    ],
    dead_letters: {
      queue: "creator-delivery",
      message_ids: ["msg_730"],
      rate_per_second: 2
    }
  })
});

console.log(response.status, await response.json());
