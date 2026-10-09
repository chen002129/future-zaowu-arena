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
- Current source-of-truth seed file: `site/data/events.json`
- CloudBase import files: `cloudbase-import/*.jsonl`
- Frontend preview fallback data: `site-v2/data/events.json`
- China-region AI competitions only.
- Deadline changes must retain history; never silently overwrite deadline history.

### Deployment
- For production, prefer CloudBase because this product needs database, APIs, user interactions and scheduled jobs.
- Deploy `site-v2/` as the frontend.
- Keep GitHub connected so future frontend commits can be redeployed automatically.
- GitHub Pages is only a preview channel, not the production backend.

### Before any deployment
1. Read this file.
2. Confirm deploy root is `site-v2/`.
3. Preserve existing UI and assets.
4. Verify the frontend can reach the CloudBase API.
5. Verify `/api/content`, event detail, map, likes/saves, submissions, and admin entry.
