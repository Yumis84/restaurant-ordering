# KDS VPS deployment

This deployment profile runs the restaurant staff application as a real Next.js server.
It does not replace the customer GitHub Pages deployment.

## Safety defaults

- The container binds only to `127.0.0.1:3000`.
- `KDS_LIVE_ENABLED=false` is the default.
- Production secrets belong only in the VPS environment file.
- Do not expose port 3000 directly to the internet.
- Put HTTPS reverse proxy in front of the container.
- Enforce a request-body limit at the reverse proxy before enabling live KDS.

## First preview

1. Clone the feature branch on the selected VPS.
2. Copy `.env.kds.example` to a server-local environment file and fill secrets.
3. Keep `KDS_LIVE_ENABLED=false`.
4. Run `docker compose --env-file <server-env> -f compose.kds.yml up -d --build`.
5. Reverse proxy `shavalleya.online` to `http://127.0.0.1:3000`.
6. Verify HTTPS and open `/orders` for the safe demo board.

## Live cutover

Do not set `KDS_LIVE_ENABLED=true` until the draft database migrations, staff bootstrap,
authorization tests, transition tests, Telegram compatibility, and rollback gate have passed.
