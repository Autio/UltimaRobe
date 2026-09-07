# Beta validation

## 0.3.0-beta.1

- Bundled Dex, gateway, database, frontend, backend, and sprite service start from fresh volumes.
- A real Chromium browser completes Dex password login and the OIDC callback, then uploads a synthetic fixture through the authenticated API, equips it with the keyboard, and saves an outfit through the interface.
- Calibration rejects unordered landmarks, preserves per-avatar settings when switching appearances, and produces a dressed composite.
- Regeneration preserves the accepted sprite; API checks cover candidate review, dismissal, acceptance, and owner isolation.
- A private backup was restored into a fresh source directory and new volumes. The restored stack retained the login identity, saved outfits, personal avatar selection, item adjustments, completed jobs, and sprite images. Browser login, another upload, and outfit saving also passed after restore.
- Six setup/archive validation tests, eleven sprite geometry/calibration checks, and 25 frontend tests pass. TypeScript and production builds pass. Frontend regression coverage includes renderer availability and explicit sprite acceptance.

Reproduce core checks with `python scripts/integration_check.py`; use `--bundled` to include a real browser login through Dex. The browser test seeds uploads through the authenticated API rather than exercising the upload dialog. Local bundled setup creates one account and remains localhost-only. External-provider browser flows and the optional GPU renderer are not covered by these checks.

## 0.2.0-beta.1

Validated on Linux Docker with a fresh, isolated PostgreSQL database and new data volumes:

- Full core container builds, migration, and health-ordered startup.
- Signed OIDC ID-token exchange; anonymous requests and mismatched subjects rejected.
- Synthetic clothing upload, saved-outfit creation/retrieval, and cross-account access rejection.
- Authenticated sprite API, default avatars, personal avatar switching/preservation, and per-owner item details.
- Actual queued sprite generation, inventory image retrieval, and dressed PNG composition.
- Avatar selection, placement settings, job records, and generated images survive sprite-container recreation.
- Login page responds; anonymous inventory bridge requests return HTTP 401.
- A stopped test database makes the readiness endpoint return HTTP 503.
- 23 frontend regression tests, TypeScript checking, and production frontend builds pass.
- Three installation configuration tests pass. The nine geometry checks passed during the initial export; garment geometry is unchanged in this beta.

The repeatable `scripts/integration_check.py` harness passed and cleaned up its disposable containers and volumes. Existing personal installations were not migrated or altered during these tests.

## Coverage limits

The 0.2 core OIDC check uses a temporary signed-token fixture. The 0.3 bundled check additionally exercises Dex in Chromium; it does not cover every external identity provider or every onboarding/upload dialog. The optional GPU container and a clean-machine GPU render remain outside this suite. Realistic rendering and custom-avatar fit remain experimental.

Dependency and Docker build warnings remain. These checks do not constitute a dependency or security audit. GitHub Actions is provided as a workflow template because the publishing credential cannot install workflows; checks were run directly during release validation.
