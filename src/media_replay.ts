import { z } from "zod";

export const mediaEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("asset.ingested"),
    event_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    delivered: z.boolean(),
    asset_id: z.string().min(1),
    creator_id: z.string().min(1),
    source_name: z.string().min(1)
  }).strict(),
  z.object({
    kind: z.literal("processing.completed"),
    event_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    delivered: z.boolean(),
    asset_id: z.string().min(1),
    job_id: z.string().min(1),
    rendition: z.enum(["preview", "720p", "1080p", "4k"])
  }).strict(),
  z.object({
    kind: z.literal("creator.delivery.ready"),
    event_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    delivered: z.boolean(),
    asset_id: z.string().min(1),
    creator_id: z.string().min(1),
    download_path: z.string().startsWith("/")
  }).strict()
]);

export const replayRequestSchema = z.object({
  webhook_id: z.string().min(1),
  creator_endpoint: z.string().url(),
  missed_since: z.string().datetime(),
  events: z.array(mediaEventSchema).min(1).max(100),
  dead_letters: z.object({
    queue: z.string().min(1),
    message_ids: z.array(z.string().min(1)).max(100),
    rate_per_second: z.number().int().min(1).max(20)
  }).strict()
}).strict();

export type MediaEvent = z.infer<typeof mediaEventSchema>;
export type ReplayRequest = z.infer<typeof replayRequestSchema>;

export function selectMissedEvents(events: MediaEvent[], missedSince: string): MediaEvent[] {
  const boundary = Date.parse(missedSince);
  const unique = new Map<string, MediaEvent>();

  for (const event of events) {
    if (!event.delivered && Date.parse(event.occurred_at) >= boundary) {
      const previous = unique.get(event.event_id);
      if (!previous || Date.parse(event.occurred_at) > Date.parse(previous.occurred_at)) {
        unique.set(event.event_id, event);
      }
    }
  }

  return [...unique.values()].sort(
    (left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
  );
}
