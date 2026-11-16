# Future Maker Arena / 未来造物赛场

## Scope
This repository is the active Future Maker Arena product.

### Frontend
- Active frontend: `site-v2/`
- Do NOT deploy `site/` as the current product UI.
- Do NOT redesign the UI unless explicitly requested.
- Mobile experience is primary.
- Keep the current Future Maker logo asset and current playful map / intelligence-desk interaction direction.

### Backend
- Production backend target: Tencent CloudBase environment `ai-class-signup`.
- Collections already created:
  - events
  - flashes
  - articles
  - user_actions
  - event_stats
  - submissions
  - deadline_history
- Frontend content endpoint target: `/api/content`
- Event content, intelligence, likes, saves, heat and submissions must come from the backend. Do not replace real backend data with fabricated frontend counts.

### Data
- Single source of truth: `site/data/events.json`
- Public live-data mirror: `https://chen002129.github.io/future-zaowu-arena/data/events.json`
- CloudBase import files: `cloudbase-import/*.jsonl`
- Frontend fallback only: `site-v2/data/events.json`
- The frontend reads `/api/content` first, GitHub Pages live data second, and local fallback last.
- China-region AI competitions only.
- Deadline changes must retain history; never silently overwrite deadline history.

### Deployment
- Deploy `site-v2/` as the only active frontend. WorkBuddy can be the user's only manual deployment tool.
- Event-data refreshes do NOT require a WorkBuddy redeploy: GitHub Actions updates `site/data/events.json`, GitHub Pages exposes it publicly, and the deployed frontend reads it at runtime.
- CloudBase remains optional for interactions / APIs / admin features; lack of a custom domain does not block live event updates.
- GitHub Pages is the public live-data + preview channel, not the interaction backend.

### Before any deployment
1. Read this file.
2. Confirm deploy root is `site-v2/`.
3. Preserve existing UI and assets.
4. Verify the frontend can reach the CloudBase API.
5. Verify `/api/content`, event detail, map, likes/saves, submissions, and admin entry.
