import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from setup import configure_local
from backup import safe_extract

class ReleaseToolsTests(unittest.TestCase):
    def test_local_setup_preserves_existing_installation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'compose.json').write_text(json.dumps({'services':{'frontend':{'ports':['3000:3000']}},'volumes':{}}))
            configure_local(root,'test@example.org','$2b$12$synthetic-hash-for-config-test')
            original=(root/'.env').read_bytes()
            self.assertNotIn('ports',json.loads((root/'compose.local.json').read_text())['services']['frontend'])
            with self.assertRaises(ValueError):configure_local(root,'other@example.org','$2b$12$another')
            self.assertEqual((root/'.env').read_bytes(),original)

    def test_backup_rejects_traversal_before_extracting(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);archive=root/'unsafe.zip';dest=root/'extract';dest.mkdir()
            with zipfile.ZipFile(archive,'w') as z:
                z.writestr('manifest.json','{"format":1}')
                z.writestr('config/../../escaped','no')
            with self.assertRaises(ValueError):safe_extract(archive,dest)
            self.assertFalse((root/'escaped').exists())
            self.assertFalse((dest/'manifest.json').exists())

    def test_backup_format_validates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);archive=root/'safe.zip';dest=root/'extract';dest.mkdir()
            with zipfile.ZipFile(archive,'w') as z:z.writestr('manifest.json','{"format":1,"services":["spritefy"]}')
            self.assertEqual(safe_extract(archive,dest)['services'],['spritefy'])

if __name__=='__main__':unittest.main()
