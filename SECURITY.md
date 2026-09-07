# Security

UltimaRobe is beta software. It has not received an independent security audit.

Use GitHub's Security → Report a vulnerability for private reports. Include the affected revision, reproduction steps, and impact, with credentials and personal photos removed. Do not publish vulnerabilities containing user data in public issues. There is no guaranteed response-time commitment for this volunteer project.

Keep the private sprite and render services behind the authenticated frontend. Keep .env, database backups, avatar photos, and logs out of source control. Use TLS and OIDC when exposing the web app. Never enable development authentication on a public deployment.
