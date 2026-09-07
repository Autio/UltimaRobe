"""Build a disposable installation and run authenticated synthetic smoke tests.

Requires Docker Compose and several GB of free disk. No production .env or data
is copied. Only the randomly named test project's volumes are removed afterward.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import uuid
import argparse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundled',action='store_true',help='Test real Dex browser login as well as sprites; downloads the Playwright browser image.')
    args=parser.parse_args()
    project='ultimarobe-check-'+uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix=project+'-') as directory:
        work=Path(directory)/'source'
        shutil.copytree(ROOT,work,ignore=shutil.ignore_patterns('.git','.env','.env.*','private','compose.local.json','backups','.backup.lock','node_modules','.next','__pycache__','.venv','data','uploads','*.log','*.tsbuildinfo'))
        if args.bundled:
            from setup import configure_local
            result=subprocess.run(['docker','run','--rm','-i','httpd:2.4-alpine','htpasswd','-niBC','12','user'],input='Synthetic-test-only-03!\n',text=True,capture_output=True,check=True)
            configure_local(work,'tester@example.org',result.stdout.strip().split(':',1)[1])
        else:subprocess.run([sys.executable,'scripts/configure.py'],cwd=work,check=True)
        filename='compose.local.json' if args.bundled else 'compose.json'
        path=work/filename;compose=json.loads(path.read_text())
        compose['services']['gateway' if args.bundled else 'frontend']['ports']=['127.0.0.1::3000']
        if not args.bundled:compose['services']['backend']['environment'].update(OIDC_ISSUER_URL='http://localhost:19090',OIDC_CLIENT_ID='release-test')
        path.write_text(json.dumps(compose))
        base=['docker','compose','-p',project,'-f',filename]
        def run(*arguments):return subprocess.run(base+list(arguments),cwd=work,check=True)
        try:
            run('up','-d','--build','--wait','--wait-timeout','300')
            for service,script in (('spritefy','smoke_sprite.py'),('backend','smoke_backend.py')):
                if args.bundled and service=='backend':continue
                run('cp','scripts/'+script,service+':/tmp/'+script)
                run('exec','-T',service,'python','/tmp/'+script)
            run('cp','scripts/smoke_sprite_03.py','spritefy:/tmp/smoke_sprite_03.py')
            run('exec','-T','spritefy','python','/tmp/smoke_sprite_03.py')
            if args.bundled:
                gateway=subprocess.run(base+['ps','-q','gateway'],cwd=work,capture_output=True,text=True,check=True).stdout.strip()
                subprocess.run(['docker','run','--rm','--network','container:'+gateway,'-v',str(work/'scripts')+':/tests:ro','mcr.microsoft.com/playwright:v1.58.2-noble','bash','-lc','cd /tmp && npm install --silent playwright@1.58.2 && NODE_PATH=/tmp/node_modules node /tests/browser_login.cjs'],check=True)
            run('up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','120','spritefy')
            run('cp','scripts/smoke_sprite.py','spritefy:/tmp/smoke_sprite.py')
            run('exec','-T','spritefy','python','/tmp/smoke_sprite.py','--verify-persistence')
            run('exec','-T','frontend','node','-e',"Promise.all(['/login','/api/inventory/sprites','/api/inventory/render?status=1'].map(async(path)=>{const r=await fetch('http://localhost:3000'+path,{redirect:'manual'});if(r.status!==(path==='/login'?200:401))throw Error(path+' '+r.status);})).catch(e=>{console.error(e.message);process.exit(1)})")
            print('PASS: isolated core installation and authenticated smoke tests.')
        finally:
            # project is generated above, never accepted from config/user input.
            subprocess.run(base+['down','--volumes','--remove-orphans'],cwd=work,check=False)

if __name__=='__main__':main()
