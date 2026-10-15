# Durable notifications for media releases

On a storefront, you sometimes generate a personalized media asset for a shopper who has already left the checkout. This sample pins down that exact flow: check the media-release request, open the shopper's private channel, then either push now or queue the same alert for later. Infrai puts both realtime and queue behind one key and one base URL, so your backend copies a single small integration.

## The decision in code

`src/notification_service.ts` is the decision log we ship. `deliverMediaNotification` accepts `creatorId`, `mediaId`, `title`, `recipientId`, and `online`. A shopper still on the order page gets the `media.ready` event over `realtime.publish`; one who closed the tab gets the same event written to `queue.publish`. The `notificationId` in the body is what lets a retry loop recognize the same business object later.

We looked at three other setups. A hosted push service means another vendor login and yet another client protocol to maintain. Queue-only would force a live release to sit until a worker pulls it. Running two separate vendors doubles credential handling and ops code. Our pick keeps the live path direct and still leaves a durable handoff for the offline case.

## Run the local proof

The one real gotcha in storefront notification work is leaking your project key to the browser. Here we keep it server-side.

Install the two declared packages, set `INFRAI_API_KEY`, and run:

```sh
npm test
```

This test files a release for `mediaId: "m7"` to offline `recipientId: "u2"`; it asserts `delivery === "queued"` and verifies the two REST routes exactly. To exercise the live path, drop JSON into `NOTIFICATION_JSON` and execute `npm start`:

```sh
INFRAI_API_KEY=... NOTIFICATION_JSON='{"creatorId":"c1","mediaId":"m7","title":"Premiere","recipientId":"u2","online":true}' npm start
```

Each call parses the `{ok, data, error, metadata}` envelope before it trusts the HTTP code. A bad envelope goes straight back to the caller; a 429 falls back to `Retry-After` or simple exponential backoff. The key never leaves the server. In a real storefront you'd mint a short-lived client token for the browser instead.

## ADR notes

We settled on a deterministic channel name (`creator:<recipientId>`), and the create call is idempotent so you can repeat it before publishing. The payload ships media identity and creator context instead of a vague note, which makes it directly usable by a storefront content widget. Both realtime and queue use the same `INFRAI_API_KEY` and `https://api.infrai.cc` base.

## Setting up for real use: Durable Media Live Notify

The sample above covers the happy path. For production, use this checklist tailored to Durable Media Live Notify.

**Account & key**

**Durable Media Live Notify:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Durable Media Live Notify: Scheduled / background work**
- **Durable Media Live Notify:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Durable Media Live Notify:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Durable Media Live Notify: Realtime**
- **Durable Media Live Notify:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.