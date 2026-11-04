import json
import hashlib
import sqlite3
import unittest
from pathlib import Path
from zipfile import ZipFile
from prepare_catalog import OUT, ROOT, pngs
from verified_weapons import normal_geometry


class VerifiedWeaponTests(unittest.TestCase):
    def test_client_matches_original_server_data_and_weapon_slots(self):
        ref = json.loads((ROOT / 'studio/reference/hso403/client.json').read_text())
        self.assertEqual(ref['jarSha256'], 'f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6')
        self.assertEqual(ref['bodyCropByFrame'], [0, 0, 1, 2, 3, 4])
        for cls in ref['classes']:
            self.assertEqual(cls['weaponFamily'], 50 + cls['clazz'])
            for check in cls['weaponReferences']:
                data = (ROOT / f"hso/data/part_char/imgver/x1/{cls['weaponFamily']}_{check['part']}").read_bytes()
                png, _, _ = next(pngs(data))
                self.assertEqual(hashlib.sha256(png).hexdigest(), check['pngSha256'])
                self.assertEqual(data[data.index(png) + len(png):].hex(), check['metadataHex'])
        with sqlite3.connect(OUT / 'catalog.sqlite') as db:
            rows = db.execute('SELECT clazz,part,definition FROM hso_weapon_sheets').fetchall()
            self.assertEqual(len(rows), 96)
            for clazz, part, data in rows:
                info = json.loads(data)
                self.assertEqual(info['source'].rsplit('/', 1)[1], f'{50 + clazz}_{part}')
                self.assertTrue(db.execute('SELECT 1 FROM item3 WHERE clazz=? AND part=? AND type IN (8,9,10,11)', (clazz, part)).fetchone())
                parsed = normal_geometry((ROOT / 'hso/data' / info['source']).read_bytes(), pngs, info['density'])
                self.assertEqual(parsed['frames'], info['frames'])
                self.assertEqual(parsed['offsets'], info['offsets'])
            stored = json.loads(db.execute('SELECT definition FROM hso_client_reference').fetchone()[0])
            for cls in stored['classes']:
                image = (OUT / cls['splash']['image']).read_bytes()
                self.assertEqual(hashlib.sha256(image).hexdigest(), cls['splash']['sha256'])
                for direction in cls['splash']['frames']:
                    for frame in direction:
                        self.assertLessEqual(frame['sx'] + frame['w'], cls['splash']['width'])
                        self.assertLessEqual(frame['sy'] + frame['h'], cls['splash']['height'])

    def test_pinned_download_matches_reference_if_present(self):
        jar = Path('/tmp/hso-client-official-403.jar')
        if not jar.exists():
            self.skipTest('External original JAR not present; offline reference checks still run')
        ref = json.loads((ROOT / 'studio/reference/hso403/client.json').read_text())
        self.assertEqual(hashlib.sha256(jar.read_bytes()).hexdigest(), ref['jarSha256'])
        with ZipFile(jar) as z:
            for cls, digest in ref['classBytecodeSha256'].items():
                self.assertEqual(hashlib.sha256(z.read(cls + '.class')).hexdigest(), digest)
            for cls in ref['classes']:
                self.assertEqual(z.read(f"wps/{cls['folder']}/0_data").hex(), cls['splash']['metadataHex'])
