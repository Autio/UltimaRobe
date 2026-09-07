"""Validate installation configuration without printing secrets."""
import argparse
import json
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]

def read_env(path):
    values = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('\"\'')
    return values

def validate(values):
    errors = []
    for key in ('APP_URL', 'OIDC_ISSUER_URL'):
        url = urlparse(values.get(key, ''))
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
            errors.append(f'{key}: enter an HTTP(S) URL without credentials, query, or fragment.')
        elif url.hostname.endswith('example.com'):
            errors.append(f'{key}: replace the example address.')
        elif url.scheme != 'https' and url.hostname not in ('localhost', '127.0.0.1', '::1') and not url.hostname.endswith('.localhost'):
            errors.append(f'{key}: use HTTPS outside localhost.')
        elif key == 'APP_URL' and url.path not in ('', '/'):
            errors.append('APP_URL: use an origin without a path.')
    for key in ('OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'):
        value = values.get(key, '')
        if not value or value.startswith('REPLACE_'):
            errors.append(f'{key}: complete your identity-provider registration.')
    keys = ('POSTGRES_PASSWORD', 'SECRET_KEY', 'NEXTAUTH_SECRET', 'SPRITEFY_KEY', 'IMAGE_RENDER_KEY')
    for key in keys:
        if len(values.get(key, '')) < 32:
            errors.append(f'{key}: use an independently generated secret of at least 32 characters.')
    if len({values.get(key) for key in keys}) != len(keys):
        errors.append('Application secrets must be different from one another.')
    # The database password is interpolated into a URL; configure.py uses hex.
    password = values.get('POSTGRES_PASSWORD', '')
    if password and not all(c.isalnum() or c in '-_' for c in password):
        errors.append('POSTGRES_PASSWORD: use letters, digits, hyphens, or underscores for URL compatibility.')
    return errors

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network', action='store_true', help='Check OIDC discovery from this computer.')
    parser.add_argument('--config-only', action='store_true', help='Skip Docker checks.')
    args = parser.parse_args()
    try:
        values = read_env(ROOT / '.env')
    except FileNotFoundError:
        print('FAIL: .env is missing. Run python scripts/configure.py first.')
        return 1
    errors = validate(values)
    if errors:
        for error in errors:
            print('FAIL:', error)
        return 1
    print('PASS: configuration values are complete; secrets are not displayed.')
    if args.network:
        try:
            issuer = values['OIDC_ISSUER_URL'].rstrip('/')
            with urlopen(issuer + '/.well-known/openid-configuration', timeout=10) as response:
                discovery = json.load(response)
            assert discovery.get('issuer', '').rstrip('/') == issuer
            assert all(discovery.get(k) for k in ('authorization_endpoint', 'token_endpoint', 'jwks_uri'))
            print('PASS: OIDC discovery. Containers must also be able to reach this issuer.')
        except Exception:
            print('FAIL: OIDC discovery is unavailable or does not match the configured issuer.')
            return 1
    if not args.config_only:
        compose='compose.local.json' if values.get('BUNDLED_LOGIN')=='true' else 'compose.json'
        for command in (['docker', 'info'], ['docker', 'compose', '-f', compose, 'config', '--quiet']):
            try:
                result = subprocess.run(command, cwd=ROOT, capture_output=True, timeout=30)
            except (OSError, subprocess.TimeoutExpired):
                result = None
            if result is None or result.returncode:
                print('FAIL: Docker is unavailable or Compose cannot resolve this configuration.')
                return 1
        print('PASS: Docker engine and Compose configuration.')
    print('Ready to start. Register the redirect URI: ' + values['APP_URL'].rstrip('/') + '/api/auth/callback/oidc')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
