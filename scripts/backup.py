"""Create or restore an installation backup, including private login settings.

Backups contain personal photos and secrets. Keep them private.
Restore refuses a configured directory and requires a separate project name.
"""
import argparse
import json
import os
import shutil
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path
from doctor import read_env

ROOT=Path(__file__).resolve().parents[1]
DATA={'backend':('wardrobe','/data/wardrobe'),'spritefy':('sprite','/data'),'renderer':('renderer','/data'),'login':('login','/var/dex')}
ALLOWED={'manifest.json','database.sql','config','wardrobe','sprite','renderer','login'}

def safe_extract(archive,folder):
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            target=(folder/entry.filename).resolve()
            parts=Path(entry.filename).parts
            if not parts or parts[0] not in ALLOWED or not target.is_relative_to(folder.resolve()) or '\\' in entry.filename or stat.S_ISLNK(entry.external_attr>>16):
                raise ValueError('Backup contains an unsafe path or symbolic link.')
        z.extractall(folder)
    manifest=json.loads((folder/'manifest.json').read_text())
    if manifest.get('format')!=1:raise ValueError('Unsupported backup format.')
    return manifest

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['create','restore'])
    parser.add_argument('archive',type=Path)
    parser.add_argument('--project',default=read_env(ROOT/'.env').get('COMPOSE_PROJECT_NAME','ultimarobe') if (ROOT/'.env').exists() else 'ultimarobe')
    parser.add_argument('--realistic',action='store_true',help='Include an installed optional renderer.')
    args=parser.parse_args()
    if not args.project or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.project):
        raise SystemExit('Use a lowercase Compose project name.')
    if args.action=='restore' and (args.project=='ultimarobe' or (ROOT/'.env').exists() or (ROOT/'private').exists()):
        raise SystemExit('Restore into a fresh source directory, with no .env/private folder, and an explicit new --project name.')
    archive=args.archive.resolve()
    if args.action=='create' and archive.exists():raise SystemExit('Backup already exists; choose a new filename.')
    compose='compose.local.json' if (ROOT/'compose.local.json').exists() else 'compose.json'
    def command(*cmd,**kwargs):return subprocess.run(list(cmd),cwd=ROOT,check=True,**kwargs)
    profiles=['--profile','realistic'] if args.realistic else []
    def dc(*cmd,**kwargs):return command('docker','compose','-p',args.project,'-f',compose,*profiles,*cmd,**kwargs)
    def container(service):return dc('ps','-a','-q',service,capture_output=True,text=True).stdout.strip()
    # This lock prevents overlapping backup/restore commands in this installation.
    lock=ROOT/'.backup.lock'
    try:lock_fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    except FileExistsError:raise SystemExit('Another backup/restore is running (.backup.lock exists).')
    os.close(lock_fd)
    try:
        with tempfile.TemporaryDirectory(prefix='ultimarobe-backup-') as temp:
            stage=Path(temp)
            if args.action=='create':
                if not (ROOT/'.env').exists():raise ValueError('Configure this installation first.')
                running=dc('ps','--status','running','--services',capture_output=True,text=True).stdout.split()
                writers=[s for s in running if s not in ('postgres','redis')]
                services={s:container(s) for s in DATA if s in json.loads(dc('config','--format','json',capture_output=True,text=True).stdout)['services']}
                services={s:c for s,c in services.items() if c}
                try:
                    if writers:dc('stop',*writers)
                    with (stage/'database.sql').open('wb') as out:dc('exec','-T','postgres','pg_dump','-U','wardrobe','--no-owner','--no-acl','wardrobe',stdout=out)
                    for service,cid in services.items():
                        name,path=DATA[service];dest=stage/name;dest.mkdir()
                        command('docker','cp',cid+':'+path+'/.',str(dest))
                    config=stage/'config';config.mkdir();shutil.copy2(ROOT/'.env',config/'.env')
                    if compose=='compose.local.json':
                        shutil.copy2(ROOT/compose,config/compose);shutil.copytree(ROOT/'private',config/'private')
                    (stage/'manifest.json').write_text(json.dumps({'format':1,'services':list(services),'version':(ROOT/'VERSION').read_text().strip()}))
                    archive.parent.mkdir(parents=True,exist_ok=True)
                    with archive.open('xb') as output:
                        os.chmod(archive,0o600)
                        with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
                            for file in stage.rglob('*'):
                                if file.is_file():z.write(file,file.relative_to(stage).as_posix())
                    print('Backup complete. Contains private photos and secrets: '+str(archive))
                finally:
                    if writers:dc('start',*writers)
            else:
                manifest=safe_extract(archive,stage)
                if 'renderer' in manifest['services']:profiles=['--profile','realistic']
                # Never restore over any existing containers or volumes for this name.
                existing=command('docker','ps','-aq','--filter','label=com.docker.compose.project='+args.project,capture_output=True,text=True).stdout.strip()
                volumes=command('docker','volume','ls','-q','--filter','label=com.docker.compose.project='+args.project,capture_output=True,text=True).stdout.strip()
                if existing or volumes:raise ValueError('The restore project already has containers or volumes; choose a new project.')
                config=stage/'config'
                shutil.copy2(config/'.env',ROOT/'.env');os.chmod(ROOT/'.env',0o600)
                values=read_env(ROOT/'.env');values['COMPOSE_PROJECT_NAME']=args.project
                (ROOT/'.env').write_text('\n'.join(f'{k}={v}' for k,v in values.items())+'\n')
                if (config/'private').exists():
                    shutil.copytree(config/'private',ROOT/'private');shutil.copy2(config/'compose.local.json',ROOT/'compose.local.json');compose='compose.local.json'
                dc('build')
                dc('create')
                dc('up','-d','--wait','postgres','redis')
                with (stage/'database.sql').open('rb') as source:dc('exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','wardrobe','-d','wardrobe',stdin=source,stdout=subprocess.DEVNULL)
                for service in manifest['services']:
                    if service not in DATA:raise ValueError('Unknown data service in backup.')
                    name,path=DATA[service];cid=container(service)
                    if not cid:raise ValueError('Enable the same optional services before restoring: '+service)
                    command('docker','cp',str(stage/name)+os.sep+'.',cid+':'+path)
                    if service=='backend':command('docker','run','--rm','--volumes-from',cid,'alpine:3.21','chown','-R','1000:1000','/data/wardrobe')
                dc('up','-d','--wait','--wait-timeout','300')
                print('Restore complete. Use --project '+args.project+' for subsequent backup commands.')
    finally:
        lock.unlink(missing_ok=True)

if __name__=='__main__':main()
