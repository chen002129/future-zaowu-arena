import { json, store, getJson, listAll, requireAdmin } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  const keys = await listAll(kv, "summary_", 500);
  const users = (await Promise.all(keys.map(k => getJson(kv, k)))).filter(Boolean);
  users.sort((a,b) => String(b.lastActiveAt || "").localeCompare(String(a.lastActiveAt || "")));
  return json({ users, total: users.length });
}
