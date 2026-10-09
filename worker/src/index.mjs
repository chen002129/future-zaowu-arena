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

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeClientId(request) {
  const value = (request.headers.get("x-client-id") || "").trim();
  return /^[a-zA-Z0-9._:-]{8,100}$/.test(value) ? value : null;
}

async function sessionUser(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id,u.provider,u.display_name,u.avatar_url,u.created_at,u.last_active_at
     FROM user_sessions s
     JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at > CURRENT_TIMESTAMP`
  ).bind(tokenHash).first();
  return row || null;
}

async function actorFromRequest(request, env) {
  const user = await sessionUser(request, env);
  if (user) return { key: "u:" + user.id, userId: user.id, clientId: safeClientId(request), user };
  const clientId = safeClientId(request);
  if (!clientId) return null;
  return { key: "c:" + clientId, userId: null, clientId, user: null };
}

function engagementFromRow(row) {
  return {
    likes: Number(row?.likes || 0),
    saves: Number(row?.saves || 0),
    views: Number(row?.views || 0),
    registrationClicks: Number(row?.registration_clicks || 0),
    heat: Math.round(Number(row?.heat || 0))
  };
}

async function publicStatsMap(env) {
  const result = await env.DB.prepare(
    "SELECT event_id,likes,saves,views,registration_clicks,heat FROM event_stats"
  ).all();
  return new Map((result.results || []).map(row => [row.event_id, engagementFromRow(row)]));
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

  const [competitionRows, flashRows, articleRows, metaRows, stats] = await Promise.all([
    env.DB.prepare(
      "SELECT payload, poster_key FROM competitions WHERE status = 'published' ORDER BY COALESCE(deadline,'9999-12-31'), updated_at DESC"
    ).all(),
    env.DB.prepare(
      "SELECT payload FROM flashes WHERE status = 'published' ORDER BY published_at DESC LIMIT 100"
    ).all(),
    env.DB.prepare(
      "SELECT payload FROM articles WHERE status = 'published' ORDER BY sort_order ASC, updated_at DESC"
    ).all(),
    env.DB.prepare("SELECT key, value FROM meta").all(),
    publicStatsMap(env)
  ]);

  const rows = competitionRows.results || [];
  const events = rows.length
    ? rows.map(row => {
        const item = parseJSON(row.payload, {});
        if (row.poster_key) item.poster = "/media/" + encodeURIComponent(row.poster_key);
        item.engagement = stats.get(item.id) || { likes:0,saves:0,views:0,registrationClicks:0,heat:0 };
        return item;
      })
    : (fallback.events || []).map(item => ({
        ...item,
        engagement: stats.get(item.id) || item.engagement || { likes:0,saves:0,views:0,registrationClicks:0,heat:0 }
      }));

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

  const oldCompetition = await env.DB.prepare(
    "SELECT deadline FROM competitions WHERE id=?"
  ).bind(body.id).first();
  const payload = JSON.stringify(body);
  if (oldCompetition && (oldCompetition.deadline || null) !== (body.deadline || null)) {
    await env.DB.prepare(
      "INSERT INTO deadline_history(event_id,old_deadline,new_deadline,source) VALUES(?,?,?,?)"
    ).bind(body.id, oldCompetition.deadline || null, body.deadline || null, body.sourceUrl || body.website || null).run();
  }
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


async function interaction(request, env) {
  const actor = await actorFromRequest(request, env);
  if (!actor) return json({ error: "client or login identity required" }, 400);
  const body = await request.json();
  const eventId = String(body?.eventId || "").trim();
  const action = String(body?.type || "").trim();
  const allowed = new Set(["view","like","unlike","save","unsave","registration_click"]);
  if (!eventId || !allowed.has(action)) return json({ error: "invalid interaction" }, 400);

  const state = await env.DB.prepare(
    "SELECT liked,saved,last_view_at,view_count,registration_click_count FROM event_user_state WHERE event_id=? AND actor_key=?"
  ).bind(eventId, actor.key).first();

  let likesDelta = 0, savesDelta = 0, viewsDelta = 0, regDelta = 0;
  let liked = Number(state?.liked || 0) === 1;
  let saved = Number(state?.saved || 0) === 1;
  let shouldLog = true;

  if (action === "like" && !liked) { liked = true; likesDelta = 1; }
  else if (action === "unlike" && liked) { liked = false; likesDelta = -1; }
  else if (action === "save" && !saved) { saved = true; savesDelta = 1; }
  else if (action === "unsave" && saved) { saved = false; savesDelta = -1; }
  else if (action === "registration_click") { regDelta = 1; }
  else if (action === "view") {
    const last = state?.last_view_at ? Date.parse(state.last_view_at + (state.last_view_at.endsWith("Z") ? "" : "Z")) : 0;
    if (!last || Date.now() - last >= 30 * 60 * 1000) viewsDelta = 1;
    else shouldLog = false;
  } else if ((action === "like" && liked) || (action === "unlike" && !liked) || (action === "save" && saved) || (action === "unsave" && !saved)) {
    shouldLog = false;
  }

  await env.DB.prepare(
    `INSERT INTO event_user_state(event_id,actor_key,user_id,client_id,liked,saved,first_view_at,last_view_at,view_count,registration_click_count,updated_at)
     VALUES(?,?,?,?,?,?,CASE WHEN ?='view' THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN ?='view' THEN CURRENT_TIMESTAMP ELSE NULL END,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(event_id,actor_key) DO UPDATE SET
       user_id=COALESCE(excluded.user_id,event_user_state.user_id),
       client_id=COALESCE(excluded.client_id,event_user_state.client_id),
       liked=excluded.liked,
       saved=excluded.saved,
       first_view_at=COALESCE(event_user_state.first_view_at,excluded.first_view_at),
       last_view_at=CASE WHEN ?='view' THEN CURRENT_TIMESTAMP ELSE event_user_state.last_view_at END,
       view_count=event_user_state.view_count+?,
       registration_click_count=event_user_state.registration_click_count+?,
       updated_at=CURRENT_TIMESTAMP`
  ).bind(
    eventId, actor.key, actor.userId, actor.clientId, liked ? 1 : 0, saved ? 1 : 0,
    action, action, viewsDelta, regDelta, action, viewsDelta, regDelta
  ).run();

  await env.DB.prepare(
    `INSERT INTO event_stats(event_id,likes,saves,views,registration_clicks,heat,updated_at)
     VALUES(?,?,?,?,?,0,CURRENT_TIMESTAMP)
     ON CONFLICT(event_id) DO UPDATE SET
       likes=MAX(0,event_stats.likes+?),
       saves=MAX(0,event_stats.saves+?),
       views=MAX(0,event_stats.views+?),
       registration_clicks=MAX(0,event_stats.registration_clicks+?),
       updated_at=CURRENT_TIMESTAMP`
  ).bind(
    eventId,
    Math.max(0, likesDelta), Math.max(0, savesDelta), Math.max(0, viewsDelta), Math.max(0, regDelta),
    likesDelta, savesDelta, viewsDelta, regDelta
  ).run();

  await env.DB.prepare(
    `UPDATE event_stats
     SET heat = likes*6 + saves*10 + views*0.15 + registration_clicks*14,
         updated_at=CURRENT_TIMESTAMP
     WHERE event_id=?`
  ).bind(eventId).run();

  if (shouldLog) {
    await env.DB.prepare(
      "INSERT INTO event_activity(event_id,actor_key,user_id,client_id,action) VALUES(?,?,?,?,?)"
    ).bind(eventId, actor.key, actor.userId, actor.clientId, action).run();
  }

  if (actor.userId) {
    await env.DB.prepare("UPDATE users SET last_active_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(actor.userId).run();
  }

  const stat = await env.DB.prepare(
    "SELECT likes,saves,views,registration_clicks,heat FROM event_stats WHERE event_id=?"
  ).bind(eventId).first();

  return json({
    ok: true,
    engagement: {
      ...engagementFromRow(stat),
      liked,
      saved
    }
  }, 200, { "cache-control": "no-store" });
}

async function me(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ loggedIn: false }, 200, { "cache-control": "no-store" });
  const states = await env.DB.prepare(
    `SELECT event_id,liked,saved,view_count,registration_click_count,updated_at
     FROM event_user_state WHERE user_id=? ORDER BY updated_at DESC LIMIT 200`
  ).bind(user.id).all();
  return json({ loggedIn: true, user, events: states.results || [] }, 200, { "cache-control": "no-store" });
}

async function adminUsers(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const rows = await env.DB.prepare(
    `SELECT u.id,u.provider,u.display_name,u.created_at,u.last_active_at,
       SUM(CASE WHEN a.action='view' THEN 1 ELSE 0 END) AS views,
       SUM(CASE WHEN a.action='like' THEN 1 ELSE 0 END) AS likes,
       SUM(CASE WHEN a.action='save' THEN 1 ELSE 0 END) AS saves,
       SUM(CASE WHEN a.action='registration_click' THEN 1 ELSE 0 END) AS registration_clicks
     FROM users u
     LEFT JOIN event_activity a ON a.user_id=u.id
     GROUP BY u.id
     ORDER BY u.last_active_at DESC
     LIMIT 200`
  ).all();
  return json({ users: rows.results || [] }, 200, { "cache-control": "no-store" });
}

async function adminUserActivity(request, env, userId) {
  if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
  const user = await env.DB.prepare(
    "SELECT id,provider,display_name,created_at,last_active_at FROM users WHERE id=?"
  ).bind(userId).first();
  if (!user) return json({ error: "user not found" }, 404);
  const rows = await env.DB.prepare(
    `SELECT event_id,action,created_at FROM event_activity
     WHERE user_id=? ORDER BY created_at DESC LIMIT 300`
  ).bind(userId).all();
  return json({ user, activity: rows.results || [] }, 200, { "cache-control": "no-store" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "future-zaowu-arena", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/interaction" && request.method === "POST") {
      return interaction(request, env);
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      return me(request, env);
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      return adminUsers(request, env);
    }

    if (url.pathname.startsWith("/api/admin/users/") && request.method === "GET") {
      const userId = decodeURIComponent(url.pathname.slice("/api/admin/users/".length));
      return adminUserActivity(request, env, userId);
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
