// Cloudflare Pages Function — leaderboard API.
//
// GET  /api/scores       → { scores: [{name,score,round,ts}, ...] }  (top 100)
// POST /api/scores       → { ok: true }
//   body: { name, score, round }
//
// Reads/writes a D1 database bound on the Pages project as `DB`.
// If no binding exists (local dev / DB not set up yet) the endpoints
// return graceful empty / 503 responses so the rest of the game still
// works — we never want a missing leaderboard to break play.
//
// Setup (one-time):
//   1. wrangler d1 create hyper-shards-leaderboard
//   2. Cloudflare Pages → Settings → Functions → D1 bindings: add
//      DB → hyper-shards-leaderboard
//   3. wrangler d1 execute hyper-shards-leaderboard --file functions/api/_schema.sql
//      (or paste the SQL from _schema.sql into the D1 console).

const TOP_N = 100;
// Defensive caps — clients shouldn't post numbers larger than these.
const MAX_SCORE = 99_999_999;
const MAX_ROUND = 999;

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      // Pages Functions live on the same origin, but be explicit so a
      // future preview-domain split doesn't surprise us.
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return jsonResp({ scores: [] });
  try {
    const { results } = await env.DB.prepare(
      'SELECT name, score, round, ts FROM scores ORDER BY score DESC LIMIT ?'
    ).bind(TOP_N).all();
    return jsonResp({ scores: results || [] });
  } catch (e) {
    return jsonResp({ scores: [], error: 'query_failed' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return jsonResp({ ok: false, error: 'no_db' }, 503);
  let body;
  try { body = await request.json(); }
  catch { return jsonResp({ ok: false, error: 'bad_json' }, 400); }

  // Sanitize. Mirror the same rule used at the assignment site in
  // 13-hub.js so a posted name can't carry markup or unicode tricks.
  const name = String(body.name || 'PILOT')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>"'`&]/g, '')
    .trim().toUpperCase().slice(0, 14) || 'PILOT';
  const score = Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(body.score) || 0)));
  const round = Math.max(1, Math.min(MAX_ROUND, Math.floor(Number(body.round) || 1)));
  if (!score) return jsonResp({ ok: false, error: 'no_score' }, 400);

  try {
    await env.DB.prepare(
      'INSERT INTO scores (name, score, round, ts) VALUES (?, ?, ?, ?)'
    ).bind(name, score, round, Date.now()).run();
    return jsonResp({ ok: true });
  } catch (e) {
    return jsonResp({ ok: false, error: 'insert_failed' }, 500);
  }
}
