import { json } from "./_lib.js";
export function onRequestGet() {
  return json({ ok: true, service: "future-zaowu-arena", backend: "edgeone-makers", time: new Date().toISOString() });
}
