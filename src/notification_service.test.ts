import assert from "node:assert/strict";
import { deliverMediaNotification } from "./notification_service.ts";

const calls: Array<{ path: string; body: any }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
  return new Response(JSON.stringify({ ok: true, data: { accepted: true }, metadata: {} }), { status: 200 });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await deliverMediaNotification({ creatorId: "c1", mediaId: "m7", title: "Premiere", recipientId: "u2", online: false });
assert.equal(result.delivery, "queued");
assert.equal(calls[0].path, "/v1/realtime/channel/create");
assert.equal(calls[1].path, "/v1/queue/publish");
assert.match(calls[1].body.payload, /m7:u2/);
globalThis.fetch = originalFetch;
console.log("offline viewers receive a durable queue message");
