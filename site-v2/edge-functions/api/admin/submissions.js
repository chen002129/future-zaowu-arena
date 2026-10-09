import { json, store, getJson, putJson, listAll, requireAdmin, safePart, now } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  const keys = await listAll(kv, "submission_", 500);
  const submissions = (await Promise.all(keys.map(k => getJson(kv, k)))).filter(Boolean);
  submissions.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return json({ submissions, total: submissions.length });
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  const body = await request.json();
  const id = String(body?.id || "").trim();
  const status = String(body?.status || "").trim();
  if (!id || !["pending","approved","rejected"].includes(status)) {
    return json({ error: "invalid id or status" }, 400);
  }

  const key = "submission_" + safePart(id);
  const record = await getJson(kv, key, null);
  if (!record) return json({ error: "submission not found" }, 404);

  record.status = status;
  record.reviewedAt = now();
  await putJson(kv, key, record);
  return json({ ok: true, submission: record });
}
