import { json, store, putJson, safePart, now } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const kv = store(env);
  const body = await request.json();
  const title = String(body?.title || "").trim();
  const contact = String(body?.contact || "").trim();
  if (!title || !contact) return json({ error: "title and contact are required" }, 400);

  const id = Date.now() + "_" + Math.random().toString(36).slice(2,8);
  const record = {
    id,
    title,
    organizer: String(body?.organizer || "").trim(),
    officialUrl: String(body?.officialUrl || "").trim(),
    deadline: String(body?.deadline || "").trim(),
    city: String(body?.city || "").trim(),
    contact,
    note: String(body?.note || "").trim(),
    status: "pending",
    createdAt: now()
  };

  await putJson(kv, "submission_" + safePart(id), record);
  return json({ ok: true, id, status: "pending" }, 201);
}
