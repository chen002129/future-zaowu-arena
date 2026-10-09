import {
  json, store, getJson, putJson, requireAdmin, safePart, now
} from "../_lib.js";

export async function onRequestPut({ request, env }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  const next = await request.json();
  if (!Array.isArray(next?.events)) return json({ error: "events array required" }, 400);

  const current = await getJson(kv, "content_current", { events: [] });
  const prevById = new Map((current.events || []).map(e => [String(e.id), e]));

  for (const event of next.events) {
    const old = prevById.get(String(event.id));
    if (old && (old.deadline || null) !== (event.deadline || null)) {
      const key = "deadline_" + safePart(event.id) + "_" + Date.now();
      await putJson(kv, key, {
        eventId: event.id,
        oldDeadline: old.deadline || null,
        newDeadline: event.deadline || null,
        source: event.sourceUrl || event.website || null,
        changedAt: now()
      });
    }
  }

  next.updatedAt = now();
  await putJson(kv, "content_current", next);
  return json({ ok: true, updatedAt: next.updatedAt, events: next.events.length });
}

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  return json(await getJson(kv, "content_current", { events: [], flashes: [], news: [] }));
}
