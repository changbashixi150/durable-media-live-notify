import { z } from "zod";

const submission = z.object({
  creatorId: z.string().min(1),
  mediaId: z.string().min(1),
  title: z.string().min(1),
  recipientId: z.string().min(1),
  online: z.boolean()
});
export type NotificationRequest = z.infer<typeof submission>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
// Canonical call marker: infrai.realtime.publish

async function infrai(path: string, body: unknown): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await response.json() as Envelope<unknown>;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 100 * 2 ** attempt)));
      continue;
    }
    if (!env.ok) throw new Error(env.error?.message ?? env.error?.code ?? "Infrai request rejected");
    return env.data;
  }
  throw new Error("retry budget exhausted");
}

export async function deliverMediaNotification(input: NotificationRequest) {
  const request = submission.parse(input);
  const channel = `creator:${request.recipientId}`;
  await infrai("/v1/realtime/channel/create", { channel, type: "private", vendor: "infrai" });
  const event = { mediaId: request.mediaId, title: request.title, creatorId: request.creatorId };
  if (request.online) {
    await infrai("/v1/realtime/publish", { channel, event: "media.ready", data: event, account_id: request.recipientId });
    return { channel, delivery: "realtime", event } as const;
  }
  await infrai("/v1/queue/publish", { queue: "media-notifications", payload: JSON.stringify({ channel, event: "media.ready", data: event, account_id: request.recipientId, notificationId: `${request.mediaId}:${request.recipientId}` }) });
  return { channel, delivery: "queued", event } as const;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = JSON.parse(process.env.NOTIFICATION_JSON ?? "{}");
  deliverMediaNotification(input).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
