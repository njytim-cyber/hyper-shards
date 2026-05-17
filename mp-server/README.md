# Hyper Shards — Multiplayer Server

Cloudflare Worker + Durable Object that powers cloud multiplayer.
One DO instance per room code; the Worker upgrades incoming WebSocket
connections and routes them to the matching DO.

## Deploy

```sh
# 1. (once) install wrangler globally if you haven't
npm i -g wrangler

# 2. log in to your Cloudflare account
wrangler login

# 3. deploy
cd mp-server
wrangler deploy
```

The deploy output prints a URL like:
```
https://hyper-shards-mp.<your-subdomain>.workers.dev
```

Copy that and paste it into `js/16-multiplayer.js` as `MP_WS_BASE` (the
client reads this single constant to route connections).

## Notes

- Durable Objects are available on the free Workers plan as of 2024 with
  reasonable limits. Heavy concurrent usage may need the Paid plan ($5/mo).
- The `ALLOWED_ORIGIN` var in `wrangler.toml` defaults to `*` — tighten
  to your Pages origin (e.g. `https://hyper-shards.pages.dev`) for prod.
- Server tick rate is 20 Hz, defined in `src/index.js`.
- No persistence: DO state lives only as long as the room is active. When
  the last player leaves, the room is GC'd.

## Local dev (optional)

```sh
wrangler dev
```

Runs the Worker locally on `http://localhost:8787`. Point `MP_WS_BASE` at
`ws://localhost:8787` to test two browser tabs against it.
