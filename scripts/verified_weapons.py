"""Weapon geometry and mapping verified against pinned official client 4.0.3."""
import hashlib
import json
import struct


def normal_geometry(data, pngs, density):
    images = list(pngs(data))
    if len(images) != 1:
        return None
    png, width, height = images[0]
    tail = data[data.index(png) + len(png):]
    if len(tail) != 32 or height % density:
        return None
    frames, offsets = [], []
    for i in range(4):
        values = struct.unpack_from('>bbbbbbbb', tail, i * 8)
        sx, w = values[6:]
        if sx < 0 or w <= 0 or (sx + w) * density > width:
            return None
        frames.append(dict(sx=sx, sy=0, w=w, h=height // density))
        offsets.append([list(values[j:j + 2]) for j in (0, 2, 4)])
    return dict(frames=frames, offsets=offsets)


def prepare_verified_weapons(db, game_root, out, reference_root, pngs):
    reference = json.loads((reference_root / 'client.json').read_text())
    if reference['jarSha256'] != 'f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6':
        raise ValueError('Unverified client reference')
    db.execute('CREATE TABLE hso_weapon_sheets (clazz INTEGER, part INTEGER, definition TEXT, PRIMARY KEY(clazz,part))')
    db.execute('CREATE TABLE hso_client_reference (id INTEGER PRIMARY KEY, definition TEXT)')
    count = 0
    for profile in reference['classes']:
        for check in profile['weaponReferences']:
            data = (game_root / f"part_char/imgver/x1/{profile['weaponFamily']}_{check['part']}").read_bytes()
            png, _, _ = next(pngs(data))
            if hashlib.sha256(png).hexdigest() != check['pngSha256'] or data[data.index(png) + len(png):].hex() != check['metadataHex']:
                raise ValueError('Server assets no longer match verified client reference')
        splash = profile['splash']
        image = (reference_root / splash['image']).read_bytes()
        if hashlib.sha256(image).hexdigest() != splash['sha256']:
            raise ValueError('Client WPS image checksum mismatch')
        path = f"client403/wps-{profile['clazz']}.png"
        (out / path).parent.mkdir(parents=True, exist_ok=True)
        (out / path).write_bytes(image)
        splash['image'] = path
        parts = db.execute('SELECT DISTINCT part FROM item3 WHERE clazz=? AND type IN (8,9,10,11) ORDER BY part', (profile['clazz'],)).fetchall()
        for part, in parts:
            selected = None
            for quality, density in [('x4', 4), ('x1', 1)]:
                source = f"part_char/imgver/{quality}/{profile['weaponFamily']}_{part}"
                record = db.execute('SELECT image,width,height FROM assets WHERE id=? AND image IS NOT NULL', (source,)).fetchone()
                if not record:
                    continue
                metadata = normal_geometry((game_root / source).read_bytes(), pngs, density)
                if metadata:
                    selected = dict(source=source, image=record[0], width=record[1], height=record[2], density=density, **metadata)
                    break
            if selected:
                selected.update(clazz=profile['clazz'], part=part, provenance='official-client-4.0.3', clientSha256=reference['jarSha256'])
                db.execute('INSERT INTO hso_weapon_sheets VALUES (?,?,?)', (profile['clazz'], part, json.dumps(selected)))
                count += 1
    for texture in reference.get('skillOne', {}).get('textures', {}).values():
        image = (reference_root / texture['image']).read_bytes()
        if hashlib.sha256(image).hexdigest() != texture['sha256']:
            raise ValueError('Skill #1 texture checksum mismatch')
        packet = (game_root / texture['source']).read_bytes()
        png, w, h = next(pngs(packet))
        if png != image or (w, h) != (texture['width'], texture['height']):
            raise ValueError('Skill #1 server texture no longer matches reference')
        path = f"client403/{texture['image']}"
        (out / path).write_bytes(image)
        texture['image'] = path
    db.execute('INSERT INTO hso_client_reference VALUES (1,?)', (json.dumps(reference),))
    return count
