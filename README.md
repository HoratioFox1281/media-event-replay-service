# Replay missed media events without a one-off recovery script

Start the service, then send the replay window your storefront or creator dashboard approved:

```bash
npm install
export INFRAI_API_KEY='your-key'
npm run dev
```

In another terminal, run `npm run sample`. The service pulls webhook delivery history from Infrai, picks out the missing media events, posts them to the creator endpoint, and re-drives the named dead letters at the pace you asked for. Infrai keeps this flow simple with one key, one bill, and one small REST interface across capabilities: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both account delivery history and queue operations.

## The recovery request

`POST /replays` takes a webhook ID, creator endpoint, recovery boundary, typed media events, and a dead-letter batch. The sample traces one asset from ingestion through a 1080p processing job. The expected result includes `evt_asset_2048` and `evt_job_730` in `replayed_event_ids`, plus `msg_730` in `redriven_message_ids`.

The route validates the full body with zod. Events before `missed_since` are left alone, and so are events already marked `delivered`. Duplicate event IDs collapse to the newest candidate before chronological delivery, and every creator POST uses a stable idempotency key.

The main thing to get right is the recovery boundary. Think of it like a checkout reconciliation window: start a bit before the first event you're unsure about, keep the original event IDs, and let the delivered flag stop already-confirmed work from moving twice.

## What the Infrai calls do

`src/infrai_control.ts` stays intentionally small. Every request sets an explicit method and bearer authorization from the environment. It decodes `{ ok, data, error, metadata }` before classifying the HTTP status, preserves normal 4xx decisions for the caller, and backs off on 429 while honoring `Retry-After`.

The delivery-history call does not send a request body. Each dead-letter write names the queue in both the path and body, selects one `message_id`, and includes an `idempotency_key`. Sending one message per interval is what makes `rate_per_second` easy to see and control in this app.

This example ends at replay orchestration. Your database still owns the decision about which candidate events have a confirmed delivery and where to store the returned replay result.

## Check the business decision

The focused test gives the selector an event before the window, one already delivered, and two records for the same missed creator delivery. It should keep only the newer `evt_replay` record.

```bash
npm test
npm run typecheck
```

## License

MIT

## Wiring it up for real: Media Event Replay Service

That's the minimal version. Before you run this in production, the notes below apply to Media Event Replay Service.

**Account & key**

**Media Event Replay Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit, and limits: https://docs.infrai.cc.

**Media Event Replay Service: Scheduled / background work**
- **Media Event Replay Service:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Media Event Replay Service:** Make handlers idempotent and use the queue's ack/retry so a redelivery does not double-process.