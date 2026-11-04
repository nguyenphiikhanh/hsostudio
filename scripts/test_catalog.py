import json
import sqlite3
import unittest
from prepare_catalog import OUT, values, pngs


class CatalogTests(unittest.TestCase):
    def test_mysql_escapes_and_numbers(self):
        self.assertEqual(values("(1,'Hiệp sĩ; \\'A\\'',NULL,-1),(2,'[\\\"x\\\"]',3,4);"), [[1, "Hiệp sĩ; 'A'", None, -1], [2, '["x"]', 3, 4]])

    def test_real_catalog(self):
        with sqlite3.connect(OUT / 'catalog.sqlite') as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertTrue({'account', 'player', 'naptien', 'giftcode'}.isdisjoint(tables))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mobs').fetchone()[0], 198)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM item3').fetchone()[0], 4792)
            self.assertEqual(db.execute('SELECT name FROM mobs WHERE id=1').fetchone()[0], 'Ốc sên')
            for data, in db.execute('SELECT data FROM item3'):
                self.assertIsInstance(json.loads(data), list)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM character_textures WHERE density=4').fetchone()[0], 412)
            for frames, density, width, height in db.execute('SELECT t.frames,t.density,a.width,a.height FROM character_textures t JOIN assets a ON a.id=t.asset_id'):
                for frame in json.loads(frames):
                    self.assertLessEqual((frame['sx'] + frame['w']) * density, width)
                    self.assertLessEqual((frame['sy'] + frame['h']) * density, height)
            part_count = db.execute('SELECT COUNT(*) FROM character_parts').fetchone()[0]
            self.assertEqual(part_count, 415)
            for source, slot, frames, offsets, width, height, image_path in db.execute('SELECT p.asset_id,p.slot,p.frames,p.offsets,a.width,a.height,a.image FROM character_parts p JOIN assets a ON a.id=p.asset_id'):
                self.assertEqual(image_path, 'images/' + source + ('' if source.endswith('.png') else '.png'))
                frames, offsets = json.loads(frames), json.loads(offsets)
                self.assertEqual(len(offsets), 1 if slot == 'eyes' else 24)
                for frame in frames:
                    self.assertGreater(frame['w'], 0)
                    self.assertGreater(frame['h'], 0)
                    self.assertLessEqual(frame['sx'] + frame['w'], width)
                    self.assertLessEqual(frame['sy'] + frame['h'], height)
            images = db.execute('SELECT DISTINCT image,width,height FROM assets WHERE image IS NOT NULL').fetchall()
            for path, width, height in images:
                image = (OUT / path).read_bytes()
                decoded = list(pngs(image))
                self.assertEqual(len(decoded), 1, path)
                self.assertEqual(decoded[0], (image, width, height))


if __name__ == '__main__':
    unittest.main()
