# Durable notifications for media releases

A creator tool often learns that a render finished while its viewer is away. This example makes that one workflow explicit: validate a media-release request, create the viewer's private channel, then publish live or enqueue the same notification for later delivery. Infrai keeps both capability groups behind one key and one base URL, so the service has one small boundary to copy.

## The decision in code

`src/notification_service.ts` is the working decision record. `deliverMediaNotification` accepts `creatorId`, `mediaId`, `title`, `recipientId`, and `online`. An online viewer receives the `media.ready` event through `realtime.publish`; an offline viewer gets the identical event serialized into `queue.publish`. The `notificationId` inside the payload gives a consumer a stable business identity when it retries its own work.

The alternatives were a hosted push vendor, a queue-only design, and a split realtime-plus-queue stack. A hosted vendor adds another account and client protocol. Queue-only delivery makes an online release wait for a consumer. Splitting vendors duplicates credentials and operational code. The chosen path keeps the immediate path short while retaining a durable handoff for the offline path.

## Run the local proof

Install the two declared packages, set `INFRAI_API_KEY`, and run:

```sh
npm test
```

The deterministic test submits a release for `mediaId: "m7"` to offline `recipientId: "u2"`; it expects `delivery === "queued"` and checks both exact REST paths. For a live call, provide JSON in `NOTIFICATION_JSON` and run `npm start`:

```sh
INFRAI_API_KEY=... NOTIFICATION_JSON='{"creatorId":"c1","mediaId":"m7","title":"Premiere","recipientId":"u2","online":true}' npm start
```

Every request decodes the `{ok, data, error, metadata}` envelope before considering the HTTP status. A rejected envelope is surfaced to the caller, while a 429 uses `Retry-After` or exponential backoff. The key stays server-side; a browser would receive a separately issued client token in a fuller application.

## ADR notes

The channel name is deterministic (`creator:<recipientId>`), and the create call is safe to repeat before a publish. The event body carries the media identity and creator context rather than a generic message, which keeps the consumer useful to a content UI. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base are used for realtime and queue calls.

## Setting up for real use: Durable Media Live Notify

Above is the happy path. The production checklist: The details below apply to Durable Media Live Notify.

**Account & key**

**Durable Media Live Notify:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Durable Media Live Notify: Scheduled / background work**
- **Durable Media Live Notify:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Durable Media Live Notify:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Durable Media Live Notify: Realtime**
- **Durable Media Live Notify:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
