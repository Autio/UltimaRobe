# Set up your wardrobe

## On one computer, with bundled login

Install Docker with Compose and Python 3. Windows users need Linux containers through Docker Desktop/WSL2.

1. Download and unpack the release into a new directory.
2. Run `python scripts/setup.py`. Enter an email and a password of 12–72 UTF-8 bytes. Docker creates a bcrypt hash; your password is not stored in plaintext.
3. Run `python scripts/start.py`.
4. Open **http://ultimarobe.localhost:3000**, choose SSO, and sign in with the account you created.
5. Complete or skip the wardrobe onboarding steps, upload clothing, and open Inventory.

The `.localhost` address is deliberate: browsers resolve it locally, and the containers resolve it to the bundled gateway. Do not replace it with `localhost` in one setting only. Port 3000 must be free. The app binds only to this computer; this setup does not make it publicly accessible.

Bundled login uses [Dex's local password connector](https://dexidp.io/docs/connectors/local/). The private Dex configuration and its user IDs must be kept with your backups. This first version creates one account; password changes and additional accounts require updating the private Dex configuration. Existing setup is never overwritten.

## Existing OIDC provider or remote hosting

Use `python scripts/configure.py`, edit the generated `.env`, and follow the OIDC instructions in the README. This remains the supported path for remote HTTPS hosting. Existing 0.2 installations retain their current login configuration and can use `python scripts/start.py` after updating the source.

## Fit and regenerate

Open **Fit clothes to this avatar** beneath the character. Align the five horizontal guides and adjust clothing width. Save the fit; the avatar artwork itself does not change. Settings are separate for masculine, feminine, and personal appearances.

Use the garment workshop to describe sleeve length, flare, collar, hem, and pattern. Regenerating keeps the current sprite equipped. A **Review new sprite** button appears when the candidate is ready. Choose **Use new sprite** or **Keep current sprite**. These choices are stored on the server.

## Keyboard and touch

Tab to a garment and use Enter or Space to equip or remove it; tapping works too. Equipping another item in the same slot announces which item was replaced. Small tiles retain their hover/focus information. Open the labeled inspect button to view or adjust a garment without dragging.
