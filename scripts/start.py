"""Check configuration, build, and wait for the wardrobe to become ready."""
import argparse
import subprocess
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--realistic',action='store_true',help='Also start the optional NVIDIA renderer.')
args=parser.parse_args()
check=subprocess.run([sys.executable,str(root/'scripts/doctor.py'),'--network'],cwd=root)
if check.returncode:raise SystemExit(check.returncode)
command=['docker','compose','-f','compose.json']
if args.realistic:command+=['--profile','realistic']
result=subprocess.run(command+['up','-d','--build','--wait','--wait-timeout','300'],cwd=root)
if result.returncode:
    print('Startup did not complete. Run docker compose -f compose.json ps and inspect the failing service logs. Your data volumes have been kept.')
raise SystemExit(result.returncode)
