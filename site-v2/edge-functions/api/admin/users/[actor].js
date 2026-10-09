import { json, store, getJson, listAll, requireAdmin, safePart } from "../../_lib.js";

export async function onRequestGet({ request, env, params }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  const actor = safePart(params.actor || "");
  if (!actor) return json({ error: "actor required" }, 400);
  const summary = await getJson(kv, "summary_" + actor, null);
  const keys = await listAll(kv, "activity_" + actor + "_", 300);
  const activity = (await Promise.all(keys.map(k => getJson(kv, k)))).filter(Boolean);
  activity.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return json({ summary, activity });
}
