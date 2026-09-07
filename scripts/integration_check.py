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
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    project='ultimarobe-check-'+uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix=project+'-') as directory:
        work=Path(directory)/'source'
        shutil.copytree(ROOT,work,ignore=shutil.ignore_patterns('.git','.env','.env.*','node_modules','.next','__pycache__','.venv','data','uploads','*.log','*.tsbuildinfo'))
        subprocess.run([sys.executable,'scripts/configure.py'],cwd=work,check=True)
        path=work/'compose.json';compose=json.loads(path.read_text())
        compose['services']['frontend']['ports']=['127.0.0.1::3000']
        compose['services']['backend']['environment'].update(OIDC_ISSUER_URL='http://localhost:19090',OIDC_CLIENT_ID='release-test')
        path.write_text(json.dumps(compose))
        base=['docker','compose','-p',project,'-f','compose.json']
        def run(*arguments):return subprocess.run(base+list(arguments),cwd=work,check=True)
        try:
            run('up','-d','--build','--wait','--wait-timeout','300')
            for service,script in (('spritefy','smoke_sprite.py'),('backend','smoke_backend.py')):
                run('cp','scripts/'+script,service+':/tmp/'+script)
                run('exec','-T',service,'python','/tmp/'+script)
            run('up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','120','spritefy')
            run('cp','scripts/smoke_sprite.py','spritefy:/tmp/smoke_sprite.py')
            run('exec','-T','spritefy','python','/tmp/smoke_sprite.py','--verify-persistence')
            run('exec','-T','frontend','node','-e',"Promise.all(['/login','/api/inventory/sprites','/api/inventory/render?status=1'].map(async(path)=>{const r=await fetch('http://localhost:3000'+path,{redirect:'manual'});if(r.status!==(path==='/login'?200:401))throw Error(path+' '+r.status);})).catch(e=>{console.error(e.message);process.exit(1)})")
            print('PASS: isolated core installation and authenticated smoke tests.')
        finally:
            # project is generated above, never accepted from config/user input.
            subprocess.run(base+['down','--volumes','--remove-orphans'],cwd=work,check=False)

if __name__=='__main__':main()
