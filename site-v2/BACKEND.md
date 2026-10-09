# Future Maker Arena · EdgeOne Makers backend

The production target is Tencent Cloud EdgeOne Makers.

## One-time console setup

1. Create a Makers project from this GitHub repository and set the project root/output to `site-v2`.
2. Create one Makers KV namespace and bind it to the project with variable name `FML_DATA`.
3. Add environment variable `ADMIN_TOKEN` with a long random secret and redeploy.

The API lives under `site-v2/edge-functions/api`.

## API

- GET `/api/health`
- GET `/api/content`
- POST `/api/interaction`
- POST `/api/submit`
- GET/PUT `/api/admin/content` (Bearer ADMIN_TOKEN)
- GET `/api/admin/users` (Bearer ADMIN_TOKEN)
- GET `/api/admin/users/:actor` (Bearer ADMIN_TOKEN)

Admin UI: `/admin/`

## Dynamic content sync

Set repository Actions secrets:
- `BACKEND_URL` e.g. https://your-domain.example
- `BACKEND_ADMIN_TOKEN`

When `site/data/events.json` changes, GitHub Actions pushes the latest content to the deployed backend. Deadline changes are recorded in KV before replacing the current content.

## User identity

Interactions work immediately for anonymous devices via `x-client-id`. When WeChat/phone login is connected later, create a session record in KV using:
`session_<sha256(bearerToken)> -> { userId, expiresAt }`

The interaction API automatically switches from device identity to logged-in user identity when a valid session exists.
