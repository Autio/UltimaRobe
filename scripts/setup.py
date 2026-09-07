"""Guided setup for a local wardrobe with bundled Dex login."""
import getpass
import json
import secrets
import subprocess
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def configure_local(root,email,password_hash):
    if (root/'.env').exists() or (root/'private').exists():
        raise ValueError('An installation already exists. Keep its configuration and data; setup does not overwrite it.')
    if '@' not in email or '\n' in email or '\r' in email:
        raise ValueError('Enter a valid email address.')
    if not password_hash.startswith(('$2a$','$2b$','$2y$')):
        raise ValueError('A bcrypt password hash is required.')
    origin='http://ultimarobe.localhost:3000'
    values={
        'APP_URL':origin,'OIDC_ISSUER_URL':origin+'/identity','OIDC_CLIENT_ID':'ultimarobe',
        'OIDC_CLIENT_SECRET':secrets.token_hex(32),'BUNDLED_LOGIN':'true',
        **{key:secrets.token_hex(32) for key in ('POSTGRES_PASSWORD','SECRET_KEY','NEXTAUTH_SECRET','SPRITEFY_KEY','IMAGE_RENDER_KEY')},
        'AI_INTERNAL_ENABLED':'false','VISION_MODEL':'',
    }
    private=root/'private';private.mkdir(mode=0o700)
    dex={'issuer':values['OIDC_ISSUER_URL'],'storage':{'type':'sqlite3','config':{'file':'/var/dex/dex.db'}},
         'web':{'http':'0.0.0.0:5556'},'oauth2':{'skipApprovalScreen':True},'enablePasswordDB':True,
         'staticClients':[{'id':'ultimarobe','name':'UltimaRobe','secret':values['OIDC_CLIENT_SECRET'],'redirectURIs':[origin+'/api/auth/callback/oidc']}],
         'staticPasswords':[{'email':email,'hash':password_hash,'username':email.split('@')[0],'userID':str(uuid.uuid4())}]}
    (private/'dex.json').write_text(json.dumps(dex,indent=2),encoding='utf-8')
    (private/'dex.json').chmod(0o600)
    (private/'gateway.conf').write_text('''server {
 listen 3000;
 server_name _;
 resolver 127.0.0.11 valid=10s ipv6=off;
 client_max_body_size 30m;
 location /identity/ {
  set $login_upstream http://login:5556;
  proxy_pass $login_upstream;
  proxy_set_header Host $http_host;
  proxy_set_header X-Forwarded-Proto $scheme;
 }
 location / {
  set $frontend_upstream http://frontend:3000;
  proxy_pass $frontend_upstream;
  proxy_set_header Host $http_host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 }
}
''')
    compose=json.loads((root/'compose.json').read_text())
    compose['services']['frontend'].pop('ports',None)
    compose['services']['login']={'image':'ghcr.io/dexidp/dex:v2.45.1','user':'0:0','command':['dex','serve','/etc/dex/config.json'],'volumes':['./private/dex.json:/etc/dex/config.json:ro','login_data:/var/dex'],'restart':'unless-stopped'}
    compose['services']['gateway']={'image':'nginx:1.28-alpine','ports':['127.0.0.1:3000:3000'],'volumes':['./private/gateway.conf:/etc/nginx/conf.d/default.conf:ro'],'depends_on':['frontend','login'],'networks':{'default':{'aliases':['ultimarobe.localhost']}},'healthcheck':{'test':['CMD','wget','-q','-O','/dev/null',origin+'/identity/.well-known/openid-configuration'],'interval':'5s','timeout':'5s','retries':20},'restart':'unless-stopped'}
    compose['volumes']['login_data']={}
    (root/'compose.local.json').write_text(json.dumps(compose,indent=2))
    with (root/'.env').open('x',encoding='utf-8') as f:f.write('\n'.join(f'{k}={v}' for k,v in values.items())+'\n')
    (root/'.env').chmod(0o600)

def main():
    print('Set up UltimaRobe on this computer with its own login. Existing installations are never overwritten.')
    if (ROOT/'.env').exists():raise SystemExit('Configuration already exists. Use scripts/start.py instead.')
    email=input('Your login email: ').strip()
    password=getpass.getpass('Choose a password (12–72 UTF-8 bytes): ')
    if not 12<=len(password.encode())<=72:raise SystemExit('Use a password between 12 and 72 UTF-8 bytes.')
    if password!=getpass.getpass('Repeat password: '):raise SystemExit('Passwords did not match.')
    # Pass the password on stdin, never in command arguments or logs.
    result=subprocess.run(['docker','run','--rm','-i','httpd:2.4-alpine','htpasswd','-niBC','12','user'],input=password+'\n',text=True,capture_output=True)
    if result.returncode:raise SystemExit('Could not create the password hash. Check that Docker is running.')
    password_hash=result.stdout.strip().split(':',1)[-1]
    configure_local(ROOT,email,password_hash)
    print('Ready. Run python scripts/start.py, then open http://ultimarobe.localhost:3000 .')
    print('This setup is local to this computer. For remote access use an HTTPS deployment with your own OIDC provider.')

if __name__=='__main__':main()
