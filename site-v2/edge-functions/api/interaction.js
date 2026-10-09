import {
  json, store, getJson, putJson, resolveActor, safePart, now, emptyStats, calcHeat
} from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const kv = store(env);
  const actor = await resolveActor(request, env);
  if (!actor) return json({ error: "client identity required" }, 400);

  const body = await request.json();
  const eventId = String(body?.eventId || "").trim();
  const action = String(body?.type || "").trim();
  const allowed = new Set(["view","like","unlike","save","unsave","registration_click"]);
  if (!eventId || !allowed.has(action)) return json({ error: "invalid interaction" }, 400);

  const ekey = safePart(eventId);
  const stateKey = "state_" + actor.actorKey + "_" + ekey;
  const statsKey = "stats_" + ekey;

  const state = await getJson(kv, stateKey, {
    liked: false, saved: false, viewCount: 0, registrationClickCount: 0, lastViewAt: null
  });
  const stats = await getJson(kv, statsKey, emptyStats());

  let likesDelta = 0, savesDelta = 0, viewsDelta = 0, registrationDelta = 0;
  let shouldLog = true;

  if (action === "like") {
    if (!state.liked) { state.liked = true; likesDelta = 1; } else shouldLog = false;
  } else if (action === "unlike") {
    if (state.liked) { state.liked = false; likesDelta = -1; } else shouldLog = false;
  } else if (action === "save") {
    if (!state.saved) { state.saved = true; savesDelta = 1; } else shouldLog = false;
  } else if (action === "unsave") {
    if (state.saved) { state.saved = false; savesDelta = -1; } else shouldLog = false;
  } else if (action === "registration_click") {
    registrationDelta = 1;
    state.registrationClickCount = Number(state.registrationClickCount || 0) + 1;
  } else if (action === "view") {
    const last = state.lastViewAt ? Date.parse(state.lastViewAt) : 0;
    if (!last || Date.now() - last >= 30 * 60 * 1000) {
      viewsDelta = 1;
      state.viewCount = Number(state.viewCount || 0) + 1;
      state.lastViewAt = now();
    } else {
      shouldLog = false;
    }
  }

  stats.likes = Math.max(0, Number(stats.likes || 0) + likesDelta);
  stats.saves = Math.max(0, Number(stats.saves || 0) + savesDelta);
  stats.views = Math.max(0, Number(stats.views || 0) + viewsDelta);
  stats.registrationClicks = Math.max(0, Number(stats.registrationClicks || 0) + registrationDelta);
  stats.heat = calcHeat(stats);
  stats.updatedAt = now();

  state.updatedAt = now();
  state.userId = actor.userId;
  state.clientId = actor.clientId;

  await Promise.all([
    putJson(kv, stateKey, state),
    putJson(kv, statsKey, stats)
  ]);

  const summaryKey = "summary_" + actor.actorKey;
  const summary = await getJson(kv, summaryKey, {
    actorKey: actor.actorKey, userId: actor.userId, clientId: actor.clientId,
    loggedIn: actor.loggedIn, firstSeenAt: now(),
    views: 0, likes: 0, saves: 0, registrationClicks: 0
  });
  summary.lastActiveAt = now();
  summary.userId = actor.userId || summary.userId || null;
  summary.loggedIn = Boolean(actor.userId);
  if (action === "view" && viewsDelta) summary.views = Number(summary.views || 0) + 1;
  if (action === "like" && likesDelta > 0) summary.likes = Number(summary.likes || 0) + 1;
  if (action === "unlike" && likesDelta < 0) summary.likes = Math.max(0, Number(summary.likes || 0) - 1);
  if (action === "save" && savesDelta > 0) summary.saves = Number(summary.saves || 0) + 1;
  if (action === "unsave" && savesDelta < 0) summary.saves = Math.max(0, Number(summary.saves || 0) - 1);
  if (action === "registration_click") summary.registrationClicks = Number(summary.registrationClicks || 0) + 1;
  await putJson(kv, summaryKey, summary);

  if (shouldLog) {
    const activityKey = "activity_" + actor.actorKey + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
    await putJson(kv, activityKey, {
      eventId, action, actorKey: actor.actorKey, userId: actor.userId,
      clientId: actor.clientId, createdAt: now()
    });
  }

  return json({
    ok: true,
    engagement: {
      ...stats,
      liked: Boolean(state.liked),
      saved: Boolean(state.saved)
    }
  });
}
