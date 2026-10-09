const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, "cache-control": "no-store", ...extra }
  });
}

export function store(env) {
  // EdgeOne KV bindings may be injected directly by variable name.
  if (typeof FML_DATA !== "undefined") return FML_DATA;
  if (env && env.FML_DATA) return env.FML_DATA;
  throw new Error("FML_DATA KV binding is missing");
}

export function adminToken(env) {
  if (env && env.ADMIN_TOKEN) return env.ADMIN_TOKEN;
  if (typeof ADMIN_TOKEN !== "undefined") return ADMIN_TOKEN;
  return "";
}

export function requireAdmin(request, env) {
  const expected = adminToken(env);
  const auth = request.headers.get("authorization") || "";
  return Boolean(expected) && auth === "Bearer " + expected;
}

export function safePart(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 120);
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getJson(kv, key, fallback = null) {
  const value = await kv.get(key, { type: "json" });
  return value == null ? fallback : value;
}

export async function putJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

export function now() { return new Date().toISOString(); }

export async function listAll(kv, prefix, max = 1000) {
  const keys = [];
  let cursor;
  while (keys.length < max) {
    const page = await kv.list({ prefix, limit: Math.min(256, max - keys.length), cursor });
    keys.push(...(page?.keys || []).map(x => x.key));
    if (!page || page.complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return keys;
}

export async function resolveActor(request, env) {
  const kv = store(env);
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const tokenHash = await sha256(token);
      const session = await getJson(kv, "session_" + tokenHash);
      if (session && session.userId && (!session.expiresAt || Date.parse(session.expiresAt) > Date.now())) {
        return {
          actorKey: "user_" + safePart(session.userId),
          userId: String(session.userId),
          clientId: request.headers.get("x-client-id") || null,
          loggedIn: true
        };
      }
    }
  }

  const clientId = (request.headers.get("x-client-id") || "").trim();
  if (!/^[a-zA-Z0-9._:-]{8,100}$/.test(clientId)) return null;
  return {
    actorKey: "client_" + safePart(clientId),
    userId: null,
    clientId,
    loggedIn: false
  };
}

export function emptyStats() {
  return { likes: 0, saves: 0, views: 0, registrationClicks: 0, heat: 0 };
}

export function calcHeat(s) {
  return Math.round(
    Number(s.likes || 0) * 6 +
    Number(s.saves || 0) * 10 +
    Number(s.views || 0) * 0.15 +
    Number(s.registrationClicks || 0) * 14
  );
}
