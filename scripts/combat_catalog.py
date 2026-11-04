"""Decode the four message-29 skill packets exactly as Player.load_skill does."""
import hashlib
import json
import struct

CLASSES = (
    (0, 'Chiến binh', 8, 'Kiếm', 'chienbinh'),
    (1, 'Sát thủ', 9, 'Vũ khí type 9', 'satthu'),
    (2, 'Pháp sư', 11, 'Gậy', 'phapsu'),
    (3, 'Xạ thủ', 10, 'Súng', 'xathu'),
)


class PacketReader:
    def __init__(self, data):
        self.data, self.position = data, 0

    def read(self, fmt):
        size = struct.calcsize('>' + fmt)
        if self.position + size > len(self.data):
            raise ValueError(f'Truncated skill packet at byte {self.position}')
        result = struct.unpack_from('>' + fmt, self.data, self.position)
        self.position += size
        return result[0] if len(result) == 1 else result

    def utf(self):
        size = self.read('H')
        end = self.position + size
        if end > len(self.data):
            raise ValueError(f'Truncated modified UTF string at byte {self.position}')
        value = self.data[self.position:end].replace(b'\xc0\x80', b'\0').decode('utf-8', 'surrogatepass')
        self.position = end
        return value.encode('utf-16', 'surrogatepass').decode('utf-16')


def decode_skills(data):
    reader = PacketReader(data)
    count = reader.read('b')
    if count <= 0:
        raise ValueError('Skill packet must contain skills')
    skills = []
    for _ in range(count):
        skill = dict(id=reader.read('b'), icon=reader.read('b'), name=reader.utf(),
                     type=reader.read('b'), range=reader.read('h'), detail=reader.utf(),
                     typeBuff=reader.read('b'), subEff=reader.read('b'))
        levels = reader.read('b')
        if levels <= 0:
            raise ValueError('Skill must contain level data')
        skill['levels'] = []
        for level in range(levels):
            values = reader.read('hhiibhhh')
            entry = dict(zip(('mpLost', 'LvRe', 'delay', 'timeBuff', 'per_Sub_Eff', 'time_Sub_Eff', 'plus_Hp', 'plus_Mp'), values))
            options = reader.read('b')
            if options < 0:
                raise ValueError('Invalid option count')
            entry['options'] = [dict(zip(('id', 'param'), reader.read('Bi'))) for _ in range(options)]
            entry['nTarget'], entry['range_lan'] = reader.read('bh')
            skill['levels'].append(entry)
        skill['performDur'], skill['typePaint'] = reader.read('hb')
        skills.append(skill)
    if reader.position != len(data):
        raise ValueError(f'Unread skill packet bytes: {len(data) - reader.position}')
    if sorted(skill['id'] for skill in skills) != list(range(count)):
        raise ValueError('Skill IDs must form the indexed server skill array')
    return sorted(skills, key=lambda skill: skill['id'])


def prepare_combat(db, root):
    db.execute('CREATE TABLE combat_classes (id INTEGER PRIMARY KEY, label TEXT, weapon_type INTEGER, weapon_label TEXT, source TEXT, sha256 TEXT)')
    db.execute('CREATE TABLE combat_skills (clazz INTEGER, skill_id INTEGER, definition TEXT, PRIMARY KEY(clazz,skill_id))')
    count = 0
    for clazz, label, weapon_type, weapon_label, packet_name in CLASSES:
        source = f'msg/msg_29_{packet_name}'
        data = (root / source).read_bytes()
        skills = decode_skills(data)
        types = db.execute('SELECT DISTINCT type FROM item3 WHERE clazz=? AND type BETWEEN 8 AND 11', (clazz,)).fetchall()
        if types != [(weapon_type,)]:
            raise ValueError(f'Unexpected weapon class mapping: {clazz}: {types}')
        db.execute('INSERT INTO combat_classes VALUES (?,?,?,?,?,?)', (clazz, label, weapon_type, weapon_label, source, hashlib.sha256(data).hexdigest()))
        db.executemany('INSERT INTO combat_skills VALUES (?,?,?)', [(clazz, skill['id'], json.dumps(skill, ensure_ascii=False)) for skill in skills])
        count += len(skills)
    return count
