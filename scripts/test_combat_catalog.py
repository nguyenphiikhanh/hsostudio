import hashlib
import json
import unittest
from combat_catalog import CLASSES, PacketReader, decode_skills
from prepare_catalog import ROOT, OUT
import sqlite3


class CombatCatalogTests(unittest.TestCase):
    def test_original_packets_and_catalog_match(self):
        names = ['Trọng kiếm', 'Đoản kiếm', 'Gậy tự vệ', 'Bắn thường']
        with sqlite3.connect(OUT / 'catalog.sqlite') as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM combat_skills').fetchone()[0], 84)
            for clazz, label, weapon_type, _, packet in CLASSES:
                data = (ROOT / 'hso/data/msg' / ('msg_29_' + packet)).read_bytes()
                decoded = decode_skills(data)
                self.assertEqual(len(decoded), 21)
                self.assertEqual(decoded[0]['name'], names[clazz])
                self.assertEqual(decoded[0]['levels'][0]['delay'], 1000)
                self.assertEqual({skill['performDur'] for skill in decoded}, {0})
                stored = [json.loads(row[0]) for row in db.execute('SELECT definition FROM combat_skills WHERE clazz=? ORDER BY skill_id', (clazz,))]
                self.assertEqual(stored, decoded)
                digest = db.execute('SELECT sha256 FROM combat_classes WHERE id=?', (clazz,)).fetchone()[0]
                self.assertEqual(digest, hashlib.sha256(data).hexdigest())
                self.assertEqual(db.execute('SELECT COUNT(*) FROM item3 WHERE clazz=? AND type=?', (clazz, weapon_type)).fetchone()[0], 141)
                with self.assertRaises(ValueError):
                    decode_skills(data[:-1])
                with self.assertRaises(ValueError):
                    decode_skills(data + b'\0')

    def test_java_modified_utf_handles_null_and_surrogate_pairs(self):
        data = b'A\xc0\x80\xed\xa0\xbd\xed\xb8\x80'
        reader = PacketReader(len(data).to_bytes(2, 'big') + data)
        self.assertEqual(reader.utf(), 'A\0😀')
        with self.assertRaises(ValueError):
            PacketReader(b'\0\x10abc').utf()


if __name__ == '__main__':
    unittest.main()
