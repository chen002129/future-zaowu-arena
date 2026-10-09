import { json, store, getJson, listAll, emptyStats } from "./_lib.js";

async function fallbackContent(request) {
  const url = new URL("/data/events.json", request.url);
  const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!r.ok) return { events: [], flashes: [], news: [], updatedAt: new Date().toISOString() };
  return r.json();
}

export async function onRequestGet({ request, env }) {
  const kv = store(env);
  const base = await getJson(kv, "content_current") || await fallbackContent(request);
  const events = Array.isArray(base.events) ? base.events : [];

  await Promise.all(events.map(async event => {
    const stats = await getJson(kv, "stats_" + String(event.id).replace(/[^a-zA-Z0-9_]/g, "_"), emptyStats());
    event.engagement = { ...emptyStats(), ...(stats || {}) };
  }));

  return json({
    ...base,
    events,
    updatedAt: base.updatedAt || new Date().toISOString(),
    backend: "edgeone-makers-kv"
  }, 200, { "cache-control": "no-store" });
}
