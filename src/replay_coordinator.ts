import { delay, InfraiControl } from "./infrai_control.js";
import { selectMissedEvents, type MediaEvent, type ReplayRequest } from "./media_replay.js";

export type ReplayResult = {
  history_checked: true;
  replayed_event_ids: string[];
  redriven_message_ids: string[];
};

export async function replayMediaWindow(
  request: ReplayRequest,
  infrai: InfraiControl,
  fetcher: typeof fetch = fetch
): Promise<ReplayResult> {
  await infrai.deliveryHistory(request.webhook_id);
  const selected = selectMissedEvents(request.events, request.missed_since);

  for (const event of selected) {
    await deliverCreatorEvent(fetcher, request.creator_endpoint, event);
  }

  const interval = 1000 / request.dead_letters.rate_per_second;
  for (const [index, messageId] of request.dead_letters.message_ids.entries()) {
    await infrai.redriveDeadLetter(request.dead_letters.queue, messageId, request.webhook_id);
    if (index + 1 < request.dead_letters.message_ids.length) await delay(interval);
  }

  return {
    history_checked: true,
    replayed_event_ids: selected.map((event) => event.event_id),
    redriven_message_ids: request.dead_letters.message_ids
  };
}

async function deliverCreatorEvent(
  fetcher: typeof fetch,
  endpoint: string,
  event: MediaEvent
): Promise<void> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `media-event:${event.event_id}`
    },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error(`Creator endpoint returned ${response.status}`);
}
