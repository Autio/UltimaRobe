# Development and operations

## Layout

- `frontend/`: Next.js app and authenticated service bridges.
- `backend/`: upstream Wardrowbe API and workers.
- `spritefy/`: CPU segmentation, palette conversion, garment layers, private service.
- `renderer/`: optional GPU SDXL service.
- `compose.json`: isolated container network and persistent volumes.

The browser talks to the authenticated Next.js bridge. Spritefy and the renderer trust owner IDs from that bridge, so never expose their service ports publicly. Each service has a separate random shared key. Do not enable development login on an Internet-facing deployment.

## Checks

Installation doctor: `python -m unittest discover -s scripts -p test_doctor.py`.

Full core integration: `python scripts/integration_check.py`. This builds a separate stack with fresh named volumes and a random project name, uses temporary signed OIDC fixtures, and removes only that disposable project's volumes afterward. It requires Docker and several GB of free disk; it does not copy your `.env` or data. This checks API identity validation, not an interactive browser login against a real identity provider.

Frontend: `cd frontend`, `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run build`.

Sprite geometry: install `spritefy/requirements.txt` and `pytest`; from `spritefy/`, run `python -m pytest tests`. Runtime is Linux because the AI scheduler uses `fcntl`. Geometry tests also run on Windows.

The default sprite fit uses a fixed 76-pixel reference rig width. It does not read a private portrait. Garment artwork and personal avatar photos remain approximate; use the workshop to adjust placement and regenerate cut metadata.

## Deployment

`python scripts/configure.py` generates secrets without printing them. Fill in OIDC values before starting. The app and backend both use the same OIDC client registration. See the upstream backend documentation/source for additional authentication settings.

For updates, pull a reviewed revision and rebuild using `docker compose -f compose.json up -d --build`. Database migrations run in a separate one-shot `migrate` service before the API starts. Never use `down -v` unless you intend to erase persistent data. Restore backups into an isolated installation first and verify login, uploads, sprites, and saved outfits.

The optional renderer and sprite vision analyzer share `/shared/ai-work.lock` to serialize AI work. Other applications on your host do not automatically honor this lock. Renderer memory checks may decline a job if other applications occupy the GPU. Model downloads can be large. Set `HF_HUB_OFFLINE=1` on the renderer after populating its cache if you want to prevent later downloads.

## Contributing

Keep changes focused and include checks for behavioral changes. Use synthetic clothing fixtures and generic avatars for public examples. Never commit `.env`, access tokens, photos of users, generated personal avatars, databases, or local service logs. Report security problems privately through GitHub's private vulnerability reporting if enabled; do not post credentials in issues.

## GitHub Actions

A ready-to-use workflow is included at docs/checks.workflow.yml. To enable it, copy it to .github/workflows/checks.yml using a GitHub login with workflow permissions. It runs the inventory tests, type checks, frontend build, sprite geometry checks, and Compose validation. Automated checks are not enabled by this preview publication.
