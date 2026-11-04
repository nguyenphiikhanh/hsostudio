# HSO Studio

Static Vue workbench for HSO game design data. SQLite runs in the browser through sql.js; no MySQL or backend is needed on hosting.

## Run

```sh
npm ci
npm run prepare:game
npm run dev
```

Preparation requires Python 3 and the sibling `../hso` directory. It converts the supplied MySQL dump with a scalar parser, imports only game-design tables, inventories every file in `hso/data`, and extracts complete embedded PNG streams into images with readable source-relative paths. Original source files are never modified. Accounts, player records, payment history and gift codes are excluded from the public catalog.

```sh
npm run build
npm run preview
```

Deploy the entire `dist/` directory to static hosting. For a subdirectory, build with `npm run build -- --base=/your-path/`. SQLite and WASM must be served as files, not rewritten to the HTML fallback. Generated assets occupy about 222 MB. They are ignored by Git and rebuilt before deployment. Browse images load on demand; the SQLite catalog loads once in memory.

## Workflows

- Search assets by path or ID; filter category, resolution and decoded status. Disable the resolution filter to inspect categories without x1–x4 folders.
- Browse monsters, items, fashion, skills and maps. Change fields, then apply a draft. Reset discards the selected record's draft. IDs cannot be edited.
- Drafts exist only in the current browser tab. Set the export name in the header, then export the draft ZIP to retain its JSON externally. There is no database write API or autosave.
- The character lab starts with a standing character: pants, shirt, head, hair and editor preview eyes. Use the part selectors to swap components without manually cropping. Original packet metadata supplies frame rectangles and signed anchors for 414 HSO parts. Preview now prefers original x4 PNGs and each x4 packet’s own metadata, with explicit x1 fallbacks for invalid data. Type-4 eye files are empty in this dump; Studio provides an explicitly labeled eye placeholder that can be disabled. Reset restores the default character.
- Select an image and add a layer. Select another image and replace the active layer to swap parts. Set crop X/Y/width/height and local X/Y manually. Reorder, hide and remove layers. The stage origin is at its center; layers use top-left origin.
- Direction previews show front, back, left and mirrored right simultaneously. Select a direction to enlarge it. Idle now autoplays a Studio-authored breathing cycle (four visible steps at 8 fps by default (0 → −0.5 → −1 → −0.5 logical pixels), head lifts 1px, shirt stretches around the pants waist anchor (including sheets with hands below the waist) to avoid a waist gap, feet fixed) while retaining the standing sprite crop. This is not an original-client animation. Choose idle or walking, play/pause, step through the four-step cycle and set 4–12 fps. Both states keep the chosen FPS when switching; idle and walk default to 8 fps. The inferred mapping uses clothing rectangle groups 0–4 / 5–9 / 10–14 and anchor groups of six; walking previews poses 0 → 1 → 0 → 2. It is not claimed to reproduce original client timing or animation mapping. Position edits are applied as deltas across poses; custom crop edits apply to the base front pose. Manually added layers stay static. Preview eyes hide for the back view and use one eye for side views.
- Set **Tên bản xuất** in the header. Export downloads one `<name>.zip` containing `<name>.png`, Phaser JSON Hash atlas `<name>.json`, `<name>-composition.json`, and `load-<name>.js`. References and texture keys inside the package use the same name. Vietnamese names are transliterated to lowercase filename slugs; empty or unusable names fall back to `character`. Draft export uses `<name>-drafts.zip`. The snippet shows preload and create code to put in a Phaser Scene. Atlas frames retain independent parts. Export captures only the selected direction and current pose, including horizontal flip flags; it does not export the full walking sequence. Composition metadata records the preview state. Pause first to choose an exact frame. Record drafts are included as custom metadata; the consumer decides how to apply them.

## Known boundaries

All source files are inventoried; not all formats are decoded. `unresolved` includes archives, binary metadata, and files without complete PNGs. These are not claimed to be rendered. Character frame rectangles and anchors are decoded from the selected packet; logical crops are multiplied by density before checking against physical PNG bounds. Direction and idle/walking mapping is inferred from visible sheet groups and metadata; original timing, full animation sequences, attack poses, weapon transforms and monster-to-sprite mappings still require the original client or additional format research. Monster records therefore do not guess a sprite. The raw library shows whole sprite sheets; character selectors use the first cropped frame automatically. Exports contain static frames from metadata or manual crops and an empty animation list. Walking uses three source clothing poses in a four-step preview cycle, with the shared head/hair orientation and signed anchors. Each composition layer records its source, semantic slot and provenance, including editor placeholders.

## Verification

```sh
python3 scripts/test_catalog.py
npm run build
npm run test:poses
npm run test:e2e
```

Browser tests use an installed Google Chrome at `/usr/bin/google-chrome` and Playwright. They cover catalog loading, filtering, drafts, part replacement/cropping and exported files. Catalog tests verify MySQL escaping, UTF-8, row counts, JSON fields, SQLite integrity, excluded private tables and every extracted PNG stream.

## Readable asset names

Generated PNG paths now follow the original source structure, for example:

```text
public/game/images/part_char/imgver/x1/0_0.png
public/game/images/part_char/imgver/x1/5_1.png
public/game/images/icon/x1/0.png
```

The `type_id` filenames retain the game's identifiers; they are not hashes. For basic character parts, type 0 is pants, 1 shirt, 2 head, 3 helmet, and 5 hair. A source with several embedded PNGs uses `-image-1`, `-image-2`, etc. SQLite retains the source-to-image mapping. Preparation removes only the old generated 64-character hash PNGs at the images root. Original game data stays untouched. Images are no longer deduplicated by content, so distinct source paths remain visible in the filesystem.

## H5 single-player playtest

Click **Chơi thử H5** after selecting character parts. The arena opens in an isolated dialog and snapshots those layers. Phaser loads only when the game opens. No connection to the old Java server, no account and no saved progression.

- **WASD / arrows:** eight-direction movement, normalized diagonal speed; sprites face four directions.
- **Space:** melee attack on the nearest slime within range, with a cooldown.
- **Escape / Pause:** pause; Continue resumes. Hiding the browser tab also pauses.
- Defeat **five slimes** to win. Slimes chase, deal contact damage and can defeat the player. Restart resets HP, enemies, kills and position.
- Rocks and arena boundaries block movement. Closing the dialog destroys the game and releases input listeners.

Character standing/walking textures use the Studio preview mapping and the selected HSO parts. Ground and slime art are code-drawn prototype assets; they do not claim to decode the original HSO map or monster formats. No dedicated weapon/attack sprite animation yet: a visible melee ring indicates attack range. This is a desktop prototype; touch controls and multiplayer are outside this milestone.

Decisions and scope: `docs/h5-plan.md`. Browser tests cover movement, diagonal speed, pause, combat victory, obstacle collision, defeat, restart and closing/reopening the game.


## Export a reusable part library for Phaser

1. Open Studio, choose the initial character outfit and enter **Tên bản xuất**.
2. Click **Xuất thư viện part**, which is separate from the existing single-pose **Xuất cho Phaser** action.
3. Wait for packaging and download `<name>-library.zip`. The export includes every supported character part, preferring x4, independent of the asset search/category/zoom filters.
4. Extract the whole package under your game's public assets directory. Keep the `parts/` folder and root JSON/JS files together.
5. Follow the generated `README.md` and `example.js`. The example exports `createLibraryScene(Phaser, baseUrl)`, fetches metadata, preloads the independent part atlases and creates `this.character`.

```js
// In your game Scene after creating EquipmentCharacter:
this.character.equip('shirt', 1);        // switch the shirt part
this.character.equip('helmet', 0);       // equip a helmet
this.character.equip('helmet', null);    // remove the helmet
this.character.equipItem(80);            // use a supported Studio item ID
this.character.setState('walk', 'left');
this.character.setState('idle', 'down');
```

The runtime updates on the Scene's update event, keeps all equipped parts on the same direction/animation phase, and removes its listeners on destroy or scene shutdown. Changing a part does not rebuild an atlas or require downloading another export.

Package files:

| File | Contents |
| --- | --- |
| `parts/<slot>/<id>/sheet.png` | Original PNG sheet for just this part |
| `parts/<slot>/<id>/part.json` | Editable source: ID, label, dimensions, frame crops and anchors |
| `parts/<slot>/<id>/atlas.json` | Generated Phaser atlas for just this part |
| `reindex-library.mjs` + `partSchema.js` | Node tool to validate folders and rebuild atlas/index metadata |
| `library.json` | 415 supported parts (412 original x4, 2 x1 fallbacks and the eye placeholder), source provenance, frame/anchor tables and atlas references |
| `equipment.json` | Item IDs mapped to supported shirt, pants and helmet parts |
| `animations.json` | Studio breathing idle and inferred walking cycle, four directions |
| `character.json` | Selected starting parts, position adjustments, visibility and omitted-layer report |
| `runtime.js` + `characterPose.js` | Phaser equipment controller and shared pose resolution |
| `example.js` + `README.md` | Loader, Scene factory and usage instructions |
| `drafts.json` | Current record drafts |

This library supports head/hair/pants/shirt/helmet and the explicitly marked eye placeholder. Weapons, pets and mounts are not equipped. An explicitly experimental body attack clip is included; its sequence, anchors and timing are not recovered client animation. Equipment mapping uses the same type/part convention as Studio; the consumer must enforce class and level restrictions. Raw atlas frames are retained, idle/walk are retained, with an opt-in experimental attack sequence. Custom crop edits are replaced by original frame crops, and manually assembled layers are omitted; inspect `character.omittedLayers`. Position adjustments on recognized parts are preserved. No MySQL/SQLite connection is needed in the consuming game.

Browser verification exports and unzips the complete library, validates every frame reference, then uses the exported runtime and images in a real Phaser Scene to change parts/items, remove a helmet, mirror a side view, hide back-facing eyes and clean up listeners.


## PNG x4 in preview and library export

Run `npm run prepare:game` after updating, then reload Studio. The character selectors and library ZIP use the same texture selection: **412 original PNG x4** sheets with validated crop bounds. Different x4 layouts (for example pants 45 and shirt 44) use their own packet crop and anchor metadata, rather than scaled x1 guesses.

The character keeps its logical size, position, breath offset and gameplay collider. Preview canvases keep a 4× backing resolution; the Phaser library runtime uses `1 / density` when displaying each texture. The single-pose export also preserves x4 pixels and records the scale in its loader. PNG sheets in the part library are copied without modification.

Two source files cannot be used safely as x4: `part_char/imgver/x4/0_44` has a crop outside its PNG, and `1_92` has x1-sized PNG data with out-of-bounds x4 crops. Pants 44 and shirt 92 use x1 and show a reason in preview, `part.json` and `library.json.qualityNotes`. The existing eye placeholder remains explicitly labeled x1; it is not original HSO art. No unsupported weapon/pet/mount archive is added.

`part.json` keeps logical `frames`/`offsets`, physical PNG `width`/`height`, and per-part `density`. Generated `atlas.json` uses physical pixel rectangles. Keep the runtime shipped with the ZIP; older consumers that assume every crop is a PNG pixel must read `density`.

## Add or replace a design in the exported library

Each part now has an independent folder; there is no shared atlas to repack:

```text
parts/
  shirt/
    0/
      sheet.png
      part.json
      atlas.json
    1/...
  pants/0/...
  head/0/...
  eyes/0/...
  hair/0/...
  helmet/0/...
```

To add a shirt, copy `parts/shirt/0/` to `parts/shirt/9000/`. In the copied `part.json`, set `partId` to `9000`, change `label`, and set `provenance` to `custom-design`. Replace `sheet.png`; `width` and `height` are physical PNG pixels. `frames` and `offsets` use logical x1 units; `density: 4` turns each crop into x4 pixel coordinates in the generated atlas. Keep the layout, or update those fields to match your new design. Definitions without `density` retain the original v1 meaning (`density: 1`). Clothes require 15 rectangle crops and 24 anchor pairs; head/hair/helmet require three rectangle crops and 24 anchor pairs. This is the existing four-direction rig, not arbitrary animation data.

In the extracted directory, run:

```sh
node reindex-library.mjs
```

The included Node tool needs no installed packages. It checks slot/ID folder consistency, crop bounds, anchors, actual PNG dimensions and equipment/outfit references before writing any generated files. It updates each `atlas.json` and root `library.json`; `part.json` and the image remain editable source files. If you remove a referenced part, update `equipment.json` and `character.json` too.

Reload the consuming game, then use `character.equip('shirt', 9000)`. To expose it as an item, add an entry to `equipment.json` using `slot: 'shirt'` and `partKey: 'shirt-9000'`. The runtime uses the new part's frame/anchor tables even with `provenance: 'custom-design'`.

The default example preloads all parts. For smaller load batches, `preloadLibrary(scene, baseUrl, manifest, ['shirt-0', 'pants-0', ...])` limits atlas requests to those keys. Preload a part before equipping it; the runtime rejects missing textures without changing the current outfit. All head/eye/hair dependencies needed by the outfit must also be loaded.

## Attack investigation / thử nghiệm

Select **Trạng thái → Tấn công · thử nghiệm**. Choose a class, server skill and skill level; inspect cooldown/range/typePaint/subEff/performDur and packet provenance. Pause/step the four directions and adjust pose A/B separately from anchor A/B. The default sequence `0 → 3 → 4 → 0` at 8 FPS is a trial built with original sprite crops; all classes share that trial until a class-specific mapping is verified. No generated weapon images, guessed effect mapping or hit events are added.

`combat.json` in the library ZIP contains 84 server skill definitions from four original message-29 packets, with source/hash. `animations.json.states.attack` records the editable trial, class/skill context, `experimental: true` and `provenance: studio-trial`. Use the runtime bundled with the ZIP:

```js
character.setState('attack', 'left'); // one shot; call again to replay
character.setState('idle', 'left');   // return to breathing
```

Cooldown data remains separate from animation timing. `performDur` is zero throughout the original packets; no original FPS is inferred from it. The H5 arena's sample combat is unchanged by this experiment. See [the evidence and binary format](docs/attack-investigation.md).

## HSO weapon preview: verified against client 4.0.3

Select an actual item in **Vũ khí thường HSO**. Class/level rules come from the server, and texture selection now follows the verified client chain `wear[0].part → type=50+clazz, id=part`. There are 96 mapped (class,part) appearances corresponding to real item templates; the raw 100 sheets are not a universal equipment list.

Select **Tấn công** and **skill #0** to see the original WPS attack sprites: client body frames4/5, WPS frames4–7, 40ms ticks / 25FPS. FPS and pose A/B editing are disabled in this verified basic mode. Other skills remain explicitly experimental and hide the weapon while unverified. Cosmetic weapon records still have no visual renderer.

The official Java client was obtained via [Gomobi's JAVA link](https://gomobi.vn/home/game/Knight-Age-7.html). A pinned 4.0.3 reference validates 72 server PNGs and 72 metadata tails byte for byte. Four original WPS x1 sheets are included in `reference/hso403`; they are not presented as HD. Run `npm run prepare:game` after updating and reload Studio.

Single-pose export includes the weapon/WPS currently shown. The reusable part library retains body-only equipment support and records the omitted weapon layer; its selected basic body clip carries client provenance, hash and 25FPS. [Verification details and scope](docs/client403-verification.md).

## WPS image loading during development

The `jar:x1/wps/...` string identifies the original JAR resource; the browser loads an extracted PNG such as `/game/client403/wps-0.png`. To refresh from the local original JAR, run `python3 scripts/import_client403.py KnightOnline_v403.jar` and `npm run prepare:game` from the app folder.

`public/game` remains excluded from file watchers to avoid watching 20k+ files. The Vite game-asset middleware reads the actual files rather than Vite's startup public-file snapshot, so newly extracted PNGs are immediately available. Missing game files return 404 instead of SPA HTML. After updating `vite.config.js`, restart the Studio server once; production/preview builds still need rebuilding to copy new public assets into dist.
