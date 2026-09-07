# Release notes

## 0.3.0-beta.1

- Guided local setup with bundled Dex login and a shared gateway; existing external OIDC setups remain supported.
- Per-avatar shoulder, waist, wrist, knee, ankle, and width calibration that transforms clothing without modifying the avatar image.
- Regeneration candidates preserve the accepted sprite until explicitly accepted; candidates can be dismissed.
- Garment detail presets guide both sprite generation and realistic estimates.
- Private installation backup/restore, including bundled identities, clothing, outfits, avatars, calibration, and sprite selections.
- Clear slot-replacement announcements, labeled inspect controls, keyboard focus styling, touch controls, and regeneration-review badges.
- Browser login and outfit checks, calibration/review API checks, and restoration into fresh services.

Bundled setup is local-only and creates one account. Remote HTTPS hosting still uses external OIDC configuration. Realistic image rendering remains experimental. Browser-local preferences are not part of server backups.

## 0.2.0-beta.1

- Added a setup doctor and one-command startup with configuration, OIDC discovery, and readiness checks.
- Fixed Windows CRLF startup failures in backend and frontend containers.
- Database readiness now returns HTTP 503 on failure and does not expose database error details.
- Frontend startup waits for healthy backend and sprite services; the frontend has its own health check.
- Removed implicit background-removal weight downloads from backend image builds.
- Pinned compatible sprite-service dependency versions.
- Added renderer availability detection with a clear disabled state and three UI regression tests.
- Added a disposable integration harness covering fresh migrations, signed OIDC identity sync, uploads, saved outfits, ownership boundaries, avatar switching, actual sprite jobs, composites, and persistence after container recreation.

The core wardrobe is beta. Realistic rendering and custom-avatar fit remain experimental; real-browser OIDC onboarding and the optional GPU container still need broader environment coverage.

## 0.1.0-preview

First public source snapshot: RPG-style wardrobe, pixel avatars, garment workshop, optional fantasy attributes, outfit comparisons and suggestions, measurements, and optional local realistic rendering.

Packaging changes remove personal assets and home-network settings, replace the reference palette with an original palette, make AI locking configurable, add container definitions, and document OIDC setup.

Known limits: experimental garment fit and photographic similarity; custom poses need tuning; realistic images can lose detail; clean-machine Compose installation has not yet been validated end to end. Do not interpret successful unit checks as a production security audit.
