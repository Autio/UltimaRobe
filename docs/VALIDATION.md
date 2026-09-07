# Beta validation

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

OIDC integration uses a temporary signed-token fixture, not a browser interaction with every supported identity provider. Real-browser onboarding against a real provider, backup restoration, the optional GPU container, and a clean-machine GPU render are not covered by this suite. Realistic rendering and custom-avatar fit remain experimental.

Dependency and Docker build warnings remain. These checks do not constitute a dependency or security audit. GitHub Actions is provided as a workflow template because the publishing credential cannot install workflows; checks were run directly during release validation.
