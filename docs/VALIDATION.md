# Preview validation

For the initial public export:

- 20 inventory-focused frontend tests passed.
- TypeScript type checking passed.
- Frontend Docker production build completed, including a fresh `npm ci`.
- Nine sprite geometry/placement checks passed on Windows and Linux.
- Docker Compose configuration resolved successfully with generated example secrets.
- Python sources compiled successfully.
- Public files were checked for the development machine's identifiers and private assets; only neutral generated avatars and upstream app icons are included.

The frontend build emitted dependency peer/deprecation warnings and Docker legacy ENV-format warnings. These checks do not constitute a dependency or security audit. The complete new Compose stack, identity-provider onboarding, optional renderer container, and a clean-machine GPU render have not been tested end to end. The public palette differs from the private prototype.
