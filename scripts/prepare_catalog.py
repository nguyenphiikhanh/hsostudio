"""Build a static, read-only game catalog. Never imports player/account records."""
import json
import re
import sqlite3
import struct
import zlib
from pathlib import Path
from combat_catalog import prepare_combat
from verified_weapons import prepare_verified_weapons

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'studio/public/game'
TABLES = {'mobs', 'item3', 'item4', 'item5', 'item7', 'itemoption', 'itemsell', 'shopitem3', 'fashiontemplate', 'skills', 'level', 'maps', 'map_data', 'pet'}


def values(source):
    """Parse dump scalar values without executing MySQL statements."""
    tokens, row, i = [], None, 0
    escapes = {'n': '\n', 'r': '\r', 't': '\t', '0': '\0', 'b': '\b', 'Z': '\x1a'}
    while i < len(source):
        c = source[i]
        if c == '(':
            row = []
            i += 1
        elif c == ')':
            tokens.append(row)
            row = None
            i += 1
        elif c == "'":
            i += 1
            text = ''
            while i < len(source):
                c = source[i]
                if c == '\\':
                    i += 1
                    text += escapes.get(source[i], source[i])
                elif c == "'":
                    if i + 1 < len(source) and source[i + 1] == "'":
                        text += "'"
                        i += 1
                    else:
                        i += 1
                        break
                else:
                    text += c
                i += 1
            row.append(text)
        elif c in ',; \r\n\t':
            i += 1
        else:
            end = i
            while end < len(source) and source[end] not in ',) \r\n\t;':
                end += 1
            raw = source[i:end]
            row.append(None if raw.upper() == 'NULL' else float(raw) if '.' in raw else int(raw))
            i = end
    return tokens


def pngs(data):
    """Find complete PNG streams, including those embedded in game packets."""
    start = 0
    while True:
        start = data.find(b'\x89PNG\r\n\x1a\n', start)
        if start < 0:
            return
        pos = start + 8
        try:
            width, height = struct.unpack('>II', data[pos + 8:pos + 16])
            while pos + 12 <= len(data):
                size = struct.unpack('>I', data[pos:pos + 4])[0]
                kind = data[pos + 4:pos + 8]
                pos += size + 12
                if pos > len(data):
                    break
                if kind == b'IEND':
                    yield data[start:pos], width, height
                    break
        except struct.error:
            pass
        start += 8


PART_TYPES = {0: ('pants', 'Quần'), 1: ('shirt', 'Áo'), 2: ('head', 'Đầu'), 3: ('helmet', 'Mũ'), 5: ('hair', 'Tóc')}


def decode_character_part(data, png, width, height, part_type, density=1):
    """Read logical rectangle tables + 24 signed anchor pairs; validate physical bounds. Pose zero is the standing preview."""
    expected = 15 if part_type in (0, 1) else 3
    tail = data[data.index(png) + len(png):]
    if len(tail) != expected * 4 + 48:
        return None
    frames = [dict(zip(('sx', 'sy', 'w', 'h'), tail[i:i + 4])) for i in range(0, expected * 4, 4)]
    if any(f['w'] == 0 or f['h'] == 0 or (f['sx'] + f['w']) * density > width or (f['sy'] + f['h']) * density > height for f in frames):
        return None
    offsets = [list(struct.unpack('bb', tail[i:i + 2])) for i in range(expected * 4, len(tail), 2)]
    return frames, offsets


def preview_eyes_png():
    """Editor-only substitute: original type-4 eye files in this dump are empty."""
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    row = b''.join(bytes((42, 25, 18, 255)) if x in (0, 6) else bytes(4) for x in range(7))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 7, 2, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress((b'\0' + row) * 2)) + chunk(b'IEND', b'')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'images').mkdir(exist_ok=True)
    destination = OUT / 'catalog.sqlite'
    if destination.exists():
        destination.unlink()
    db = sqlite3.connect(destination)
    sql = (ROOT / 'hso/hsoodtest.sql').read_text()
    counts = {}
    for match in re.finditer(r'CREATE TABLE `(\w+)` \((.*?)\) ENGINE=', sql, re.S):
        table, definition = match.groups()
        if table not in TABLES:
            continue
        cols = re.findall(r'^\s*`(\w+)`\s+([^\n,]+)', definition, re.M)
        db.execute(f'CREATE TABLE "{table}" (' + ','.join(f'"{name}" ' + ('INTEGER' if 'int' in kind else 'TEXT') for name, kind in cols) + ')')
        counts[table] = 0
    # Statement terminator must be outside quoted values (dump strings may contain semicolons).
    for match in re.finditer(r'INSERT INTO `(\w+)` \(([^)]+)\) VALUES\s*', sql):
        table, columns = match.groups()
        if table not in counts:
            continue
        i, quoted = match.end(), False
        end = i
        while end < len(sql):
            c = sql[end]
            if c == '\\' and quoted:
                end += 2
                continue
            if c == "'":
                quoted = not quoted
            if c == ';' and not quoted:
                break
            end += 1
        rows = values(sql[i:end])
        names = re.findall(r'`(\w+)`', columns)
        db.executemany(f'INSERT INTO "{table}" (' + ','.join(f'"{n}"' for n in names) + ') VALUES (' + ','.join('?' for _ in names) + ')', rows)
        counts[table] += len(rows)
    db.execute('CREATE TABLE assets (id TEXT PRIMARY KEY, source TEXT, category TEXT, zoom TEXT, image TEXT, width INTEGER, height INTEGER, status TEXT)')
    db.execute('CREATE TABLE character_parts (asset_id TEXT PRIMARY KEY, slot TEXT, label TEXT, part_id INTEGER, frames TEXT, offsets TEXT, provenance TEXT)')
    assets, parts, image_paths = [], [], set()
    for path in sorted((ROOT / 'hso/data').rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT / 'hso/data').as_posix()
        data = path.read_bytes()
        found = list(pngs(data)) if path.suffix != '.zip' else []
        zoom = next((p for p in path.parts if p in ('x1', 'x2', 'x3', 'x4')), '')
        category = relative.split('/')[0]
        for index, (png, width, height) in enumerate(found):
            original = Path(relative)
            name = original.name.removesuffix('.png') + (f'-image-{index}' if index else '') + '.png'
            image_path = 'images/' + (original.parent / name).as_posix()
            if image_path in image_paths:
                raise ValueError(f'Duplicate generated path: {image_path}')
            image_paths.add(image_path)
            output = OUT / image_path
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(png)
            asset_id = relative + (f'#{index}' if index else '')
            assets.append((asset_id, relative, category, zoom, image_path, width, height, 'decoded'))
            match = re.fullmatch(r'part_char/imgver/x1/(\d+)_(\d+)', relative)
            if match and index == 0 and int(match[1]) in PART_TYPES:
                part_type, part_id = int(match[1]), int(match[2])
                metadata = decode_character_part(data, png, width, height, part_type)
                if metadata:
                    slot, label = PART_TYPES[part_type]
                    item_type = {0: 1, 1: 0, 3: 2}.get(part_type)
                    item = db.execute('SELECT name FROM item3 WHERE type=? AND part=? ORDER BY id LIMIT 1', (item_type, part_id)).fetchone() if item_type is not None else None
                    title = f'{label} #{part_id}' + (f' · {item[0]}' if item else '')
                    parts.append((asset_id, slot, title, part_id, json.dumps(metadata[0]), json.dumps(metadata[1]), 'packet-metadata'))
        if not found:
            assets.append((relative, relative, category, zoom, None, 0, 0, 'unresolved'))
    # Readable paths replace the previous generated content hashes.
    for old in (OUT / 'images').glob('*.png'):
        if re.fullmatch(r'[0-9a-f]{64}\.png', old.name):
            old.unlink()
    eye_source = 'studio/preview/eyes/0.png'
    eye_image = 'images/' + eye_source
    (OUT / eye_image).parent.mkdir(parents=True, exist_ok=True)
    (OUT / eye_image).write_bytes(preview_eyes_png())
    assets.append((eye_source, eye_source, 'studio', 'x1', eye_image, 7, 2, 'decoded'))
    parts.append((eye_source, 'eyes', 'Mắt preview · không phải asset gốc', 0, json.dumps([dict(sx=0, sy=0, w=7, h=2)]), json.dumps([[-3, -20]]), 'editor-placeholder'))
    db.executemany('INSERT INTO assets VALUES (?,?,?,?,?,?,?,?)', assets)
    db.executemany('INSERT INTO character_parts VALUES (?,?,?,?,?,?,?)', parts)
    # Original x4 packets retain logical crop/anchor units, but can have their own layout.
    db.execute('CREATE TABLE character_textures (base_asset TEXT PRIMARY KEY, asset_id TEXT, frames TEXT, offsets TEXT, density INTEGER, note TEXT)')
    by_source = {asset[1]: asset for asset in assets}
    textures, quality_notes = [], []
    for base_id, slot, label, part_id, frames, offsets, provenance in parts:
        selected, density, note = base_id, 1, ''
        if provenance == 'packet-metadata':
            source = base_id.replace('/x1/', '/x4/')
            candidate = by_source.get(source)
            if candidate and candidate[4]:
                data = (ROOT / 'hso/data' / source).read_bytes()
                png, width, height = next(pngs(data))
                metadata = decode_character_part(data, png, width, height, int(source.rsplit('/', 1)[1].split('_')[0]), 4)
                if metadata:
                    selected, density = source, 4
                    frames, offsets = json.dumps(metadata[0]), json.dumps(metadata[1])
                elif data == (ROOT / 'hso/data' / base_id).read_bytes():
                    selected = source
                    note = 'File trong x4 trùng nguyên byte với x1; dùng density 1, không coi là ảnh x4.'
                else:
                    note = 'Metadata x4 có vùng cắt vượt PNG; dùng x1 để tránh cắt sai.'
            else:
                note = 'Không có PNG x4; dùng x1.'
        else:
            note = 'Mắt preview là placeholder x1 của Studio, không phải ảnh HSO x4.'
        textures.append((base_id, selected, frames, offsets, density, note))
        if note:
            quality_notes.append({'slot': slot, 'partId': part_id, 'source': selected, 'density': density, 'reason': note})
    db.executemany('INSERT INTO character_textures VALUES (?,?,?,?,?,?)', textures)
    combat_count = prepare_combat(db, ROOT / 'hso/data')
    verified_weapons = prepare_verified_weapons(db, ROOT / 'hso/data', OUT, ROOT / 'studio/reference/hso403', pngs)
    db.execute('CREATE INDEX asset_source ON assets(source)')
    db.execute('CREATE INDEX asset_filter ON assets(category, zoom, status)')
    db.commit()
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    report = {'tables': counts, 'assets': len(assets), 'decoded': sum(a[-1] == 'decoded' for a in assets), 'imageFiles': len(image_paths) + 1, 'characterParts': len(parts), 'characterX4': sum(t[4] == 4 for t in textures), 'qualityNotes': quality_notes, 'combatSkills': combat_count, 'verifiedWeaponSheets': verified_weapons}
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    db.close()
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
