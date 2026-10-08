const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=30, stale-while-revalidate=120" : "no-store",
      ...extra
    }
  });

function parseJSON(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function fallbackContent(env, request) {
  const base = new URL(request.url);
  base.pathname = env.CONTENT_FALLBACK_PATH || "/data/events.json";
  base.search = "";
  const res = await env.ASSETS.fetch(new Request(base.toString(), request));
  if (!res.ok) throw new Error("fallback data unavailable");
  return res.json();
}

async function readContent(env, request) {
  const fallback = await fallbackContent(env, request);

  const [competitionRows, flashRows, articleRows, metaRows] = await Promise.all([
    env.DB.prepare(
      "SELECT payload, poster_key FROM competitions WHERE status = 'published' ORDER BY COALESCE(deadline,'9999-12-31'), updated_at DESC"
    ).all(),
    env.DB.prepare(
      "SELECT payload FROM flashes WHERE status = 'published' ORDER BY published_at DESC LIMIT 100"
    ).all(),
    env.DB.prepare(
      "SELECT payload FROM articles WHERE status = 'published' ORDER BY sort_order ASC, updated_at DESC"
    ).all(),
    env.DB.prepare("SELECT key, value FROM meta").all()
  ]);

  const rows = competitionRows.results || [];
  const events = rows.length
    ? rows.map(row => {
        const item = parseJSON(row.payload, {});
        if (row.poster_key) item.poster = "/media/" + encodeURIComponent(row.poster_key);
        return item;
      })
    : (fallback.events || []);

  const flashes = (flashRows.results || []).length
    ? flashRows.results.map(row => parseJSON(row.payload, {}))
    : (fallback.flashes || []);

  const news = (articleRows.results || []).length
    ? articleRows.results.map(row => parseJSON(row.payload, {}))
    : (fallback.news || []);

  const meta = Object.fromEntries((metaRows.results || []).map(x => [x.key, x.value]));

  return {
    events,
    flashes,
    news,
    chg: fallback.chg || {},
    updatedAt: meta.content_updated_at || fallback.updatedAt || new Date().toISOString(),
    source: rows.length ? "d1" : "fallback"
  };
}

async function serveMedia(env, key) {
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(object.body, { headers });
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === "Bearer " + expected;
}

async function upsertCompetition(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const body = await request.json();
  if (!body || !body.id || !body.title) return json({ error: "id and title required" }, 400);

  const payload = JSON.stringify(body);
  await env.DB.prepare(
    `INSERT INTO competitions(id,title,deadline,city,mode,organizer,poster_key,website,payload,status,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,'published',CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       deadline=excluded.deadline,
       city=excluded.city,
       mode=excluded.mode,
       organizer=excluded.organizer,
       poster_key=excluded.poster_key,
       website=excluded.website,
       payload=excluded.payload,
       status='published',
       updated_at=CURRENT_TIMESTAMP`
  ).bind(
    body.id,
    body.title,
    body.deadline || null,
    body.city || null,
    body.mode || null,
    body.organizer || null,
    body.posterKey || null,
    body.website || null,
    payload
  ).run();

  await env.DB.prepare(
    "INSERT INTO meta(key,value,updated_at) VALUES('content_updated_at',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP"
  ).bind(new Date().toISOString()).run();

  return json({ ok: true, id: body.id });
}

async function upsertArticle(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const body = await request.json();
  if (!body || !body.id || !body.t) return json({ error: "id and t required" }, 400);
  await env.DB.prepare(
    `INSERT INTO articles(id,tag,title,summary,payload,status,sort_order,updated_at)
     VALUES(?,?,?,?,?,'published',?,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       tag=excluded.tag,title=excluded.title,summary=excluded.summary,payload=excluded.payload,
       status='published',sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`
  ).bind(
    body.id,
    body.tag || null,
    body.t,
    body.s || null,
    JSON.stringify(body),
    Number.isFinite(body.sortOrder) ? body.sortOrder : 0
  ).run();
  return json({ ok: true, id: body.id });
}

async function addFlash(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const body = await request.json();
  if (!body || !body.txt) return json({ error: "txt required" }, 400);
  await env.DB.prepare(
    "INSERT INTO flashes(payload,published_at,status) VALUES(?,?,'published')"
  ).bind(JSON.stringify(body), body.at || new Date().toISOString()).run();
  return json({ ok: true });
}

async function uploadMedia(request, env, key) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  if (!key) return json({ error: "media key required" }, 400);
  await env.MEDIA.put(key, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" }
  });
  return json({ ok: true, key, url: "/media/" + encodeURIComponent(key) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "future-zaowu-arena", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/content" && request.method === "GET") {
      try {
        return json(await readContent(env, request));
      } catch (error) {
        try {
          const data = await fallbackContent(env, request);
          return json({ ...data, source: "fallback", backendError: "d1_unavailable" });
        } catch {
          return json({ error: "content unavailable" }, 503);
        }
      }
    }

    if (url.pathname === "/api/admin/competition" && request.method === "POST") {
      return upsertCompetition(request, env);
    }

    if (url.pathname === "/api/admin/article" && request.method === "POST") {
      return upsertArticle(request, env);
    }

    if (url.pathname === "/api/admin/flash" && request.method === "POST") {
      return addFlash(request, env);
    }

    if (url.pathname.startsWith("/api/admin/media/") && request.method === "PUT") {
      const key = decodeURIComponent(url.pathname.slice("/api/admin/media/".length));
      return uploadMedia(request, env, key);
    }

    if (url.pathname.startsWith("/media/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice("/media/".length));
      return serveMedia(env, key);
    }

    return env.ASSETS.fetch(request);
  }
};
