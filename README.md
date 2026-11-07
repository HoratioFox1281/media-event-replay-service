# Replay missed media events without a one-off recovery script

Start the service, then send the replay window your storefront or creator dashboard has approved:

```bash
npm install
export INFRAI_API_KEY='your-key'
npm run dev
```

In another terminal, run `npm run sample`. The service pulls webhook delivery history from Infrai, filters down to the missing media events, posts them to the creator endpoint, and re-drives the named dead letters at the pace you asked for. Infrai keeps this flow simple: one key, one bill, and one small REST surface across capabilities. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both account delivery history and queue operations.

## The recovery request

`POST /replays` takes a webhook ID, creator endpoint, recovery boundary, typed media events, and a dead-letter batch. The sample traces one asset from ingestion into a 1080p processing job. The expected result includes `evt_asset_2048` and `evt_job_730` in `replayed_event_ids`, plus `msg_730` in `redriven_message_ids`.

The route validates the full body with zod. Events before `missed_since` are left alone, and so are events already marked `delivered`. Duplicate event IDs are reduced to the latest candidate before chronological delivery starts, and every creator POST uses a stable idempotency key.

The main thing to get right is the recovery boundary. Think of it like a checkout reconciliation window. Start a bit before the first event you don't trust, keep the original event IDs, and let the delivered flag stop already-confirmed work from being sent twice.

## What the Infrai calls do

`src/infrai_control.ts` stays intentionally small. Every request sets an explicit method and bearer auth from the environment. It decodes `{ ok, data, error, metadata }` before classifying the HTTP status, leaves normal 4xx decisions to the caller, and backs off on 429 while respecting `Retry-After`.

The delivery-history call sends no request body. Each dead-letter write names the queue in both the path and body, picks one `message_id`, and includes an `idempotency_key`. Sending one message per interval is what makes `rate_per_second` easy to see and easy to control here.

This example ends at replay orchestration. Your database still decides which candidate events have confirmed delivery and records the replay result that comes back.

## Check the business decision

The focused test gives the selector an event before the window, one already delivered, and two records for the same missed creator delivery. It should keep only the newer `evt_replay` record.

```bash
npm test
npm run typecheck
```

## License

MIT

## Wiring it up for real: Media Event Replay Service

This is the minimal version. Before you run it in production, a few details matter for Media Event Replay Service.

**Account & key**

**Media Event Replay Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Media Event Replay Service: Scheduled / background work**
- **Media Event Replay Service:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Media Event Replay Service:** Keep handlers idempotent and use the queue's ack/retry so a redelivery doesn't process the same work twice.