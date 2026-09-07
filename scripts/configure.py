"""Create private configuration once, without exposing generated secrets."""
from pathlib import Path
import secrets

target=Path(__file__).resolve().parents[1]/'.env'
values={
    'APP_URL':'http://localhost:3000',
    'OIDC_ISSUER_URL':'https://identity.example.com',
    'OIDC_CLIENT_ID':'ultimarobe',
    'OIDC_CLIENT_SECRET':'REPLACE_WITH_YOUR_OIDC_CLIENT_SECRET',
    **{key:secrets.token_hex(32) for key in ('POSTGRES_PASSWORD','SECRET_KEY','NEXTAUTH_SECRET','SPRITEFY_KEY','IMAGE_RENDER_KEY')},
    'OLLAMA_HOST':'http://host.docker.internal:11434',
    'VISION_MODEL':'',
    'AI_INTERNAL_ENABLED':'false',
    'AI_BASE_URL':'http://host.docker.internal:11434/v1',
    'AI_VISION_MODEL':'',
    'AI_TEXT_MODEL':'',
}
with target.open('x',encoding='utf-8') as f:
    f.write('\n'.join(f'{k}={v}' for k,v in values.items())+'\n')
target.chmod(0o600)
print('Created .env. Edit APP_URL and OIDC settings before starting. Keep this file private.')
