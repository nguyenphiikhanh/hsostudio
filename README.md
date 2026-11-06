# HSO Studio

Static Vue workbench for HSO game design data. SQLite runs in the browser through sql.js; no MySQL or backend is needed on hosting.

## Run

```sh
npm ci
npm run dev
```

The complete read-only game catalog and extracted images are included in `public/game`; no Python installation or data-preparation command is needed. The bundle contains only game-design data. Accounts, player records, payment history and gift codes are excluded.

```sh
npm run build
npm run preview
```

Deploy the entire `dist/` directory to static hosting. For a subdirectory, build with `npm run build -- --base=/your-path/`. SQLite and WASM must be served as files, not rewritten to the HTML fallback. The checked-in game bundle occupies about 170 MB. Browse images load on demand; the SQLite catalog loads once in memory.

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
npm run build
npm run test:poses
npm run test:e2e
```

Browser tests use an installed Google Chrome at `/usr/bin/google-chrome` and Playwright. They cover catalog loading, filtering, drafts, part replacement/cropping and exported files.

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

This library supports head/hair/pants/shirt/helmet and the explicitly marked eye placeholder. Weapon textures remain preview-only. Verified mount/pet rigs are included in dedicated folders and can be equipped by the v1 runtime; see docs/companions-v1.md. An explicitly experimental body attack clip is included; its sequence, anchors and timing are not recovered client animation. Equipment mapping uses the same type/part convention as Studio; the consumer must enforce class and level restrictions. Raw atlas frames are retained, idle/walk are retained, with an opt-in experimental attack sequence. Custom crop edits are replaced by original frame crops, and manually assembled layers are omitted; inspect `character.omittedLayers`. Position adjustments on recognized parts are preserved. No MySQL/SQLite connection is needed in the consuming game.

Browser verification exports and unzips the complete library, validates every frame reference, then uses the exported runtime and images in a real Phaser Scene to change parts/items, remove a helmet, mirror a side view, hide back-facing eyes and clean up listeners.


## PNG x4 in preview and library export

The character selectors and library ZIP use the same texture selection: **412 original PNG x4** sheets with validated crop bounds. Different x4 layouts (for example pants 45 and shirt 44) use their own packet crop and anchor metadata, rather than scaled x1 guesses.

The character keeps its logical size, position, breath offset and gameplay collider. Preview canvases keep a 4× backing resolution; the Phaser library runtime uses `1 / density` when displaying each texture. The single-pose export also preserves x4 pixels and records the scale in its loader. PNG sheets in the part library are copied without modification.

Two source files cannot be used safely as x4: `part_char/imgver/x4/0_44` has a crop outside its PNG, and `1_92` has x1-sized PNG data with out-of-bounds x4 crops. Pants 44 and shirt 92 use x1 and show a reason in preview, `part.json` and `library.json.qualityNotes`. The existing eye placeholder remains explicitly labeled x1; it is not original HSO art. Unsupported mount/pet rigs remain listed in companions.inventory.json; only verified rigs are exported as runtime assets.

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

Select **Tấn công** to see client body/WPS animation and sprite-effect previews. Skill slots #1–#8, #17 and #19–#20 have attack, control or area-effect previews; passive and buff slots have no weapon-attack sequence. Skill #0 previews the original WPS attack sprites at 40 ms ticks / 25 FPS. Effect previews use the main FrameImage branches and a static target fixture; secondary particles, gameplay and cooldown are not simulated. Cosmetic weapon records still have no visual renderer.

The official Java client was obtained via [Gomobi's JAVA link](https://gomobi.vn/home/game/Knight-Age-7.html). A pinned 4.0.3 reference validates 72 server PNGs and 72 metadata tails byte for byte. Four original WPS x1 sheets are included in `reference/hso403`; they are not presented as HD.

Single-pose export includes the weapon/WPS currently shown. The reusable part library retains body-only equipment support and records the omitted weapon layer; selected client skill clips carry provenance and 25FPS. [Verification details and scope](docs/client403-verification.md).

## WPS image loading during development

The `jar:x1/wps/...` string identifies the original JAR resource; the browser loads the bundled PNG at `/game/client403/wps-0.png`.

`public/game` remains excluded from file watchers to avoid watching 20k+ files. The Vite game-asset middleware reads the bundled files directly. Missing game files return 404 instead of SPA HTML. After updating `vite.config.js`, restart the Studio server once; production/preview builds copy the game assets into `dist`.

## Preview chiêu #1

Chọn **Phái nhân vật** và một **Vũ khí thường HSO** hợp lệ, chuyển **Trạng thái → Tấn công**, rồi chọn **Kỹ năng server → #1**. Khung mục tiêu mẫu hiển thị hiệu ứng chính; bốn nút hướng đổi hướng thi triển. Dùng **Tạm dừng / Frame tiếp** để kiểm tra từng tick. Chế độ này dùng 25 FPS và khóa pose A/B.

| Phái | Chiêu #1 | Internal skill | Effect | Tick phát hiệu ứng |
|---|---|---:|---:|---:|
| Chiến binh | Búa địa chấn | 23 | 28 | 9 |
| Sát thủ | Nhát chém chí mạng | 44 | 55 | 9 |
| Pháp sư | Quả cầu nội lực | 46 | 59 | 9 |
| Xạ thủ | Phát súng công phá | 19 | 23 | 4 |

PNG hiệu ứng lấy nguyên từ packet server `110_17/24/47/51/53/60`, dùng x4 sau kiểm tra kích thước. Không vẽ lại asset. Khung viền là mục tiêu kiểm tra cao 40, cách 40 hoặc 100 logical units; không phải quái gốc. Hạt/đạn ngẫu nhiên dùng seed cố định, không khẳng định trùng từng mẫu RNG Java. Một vòng xem dài 32 tick do Studio chọn để thấy hiệu ứng kết thúc; timeline thân gốc dài 11 tick (ba phái đầu) hoặc 15 tick (xạ thủ), sau đó giữ đứng yên. Đây không phải cooldown.

## Preview chiêu #2

Chọn **Kỹ năng server → #2** cùng vũ khí thường để xem chiêu theo phái: Hỏa kiếm, Độc kiếm, Đá tuyết hoặc Phóng điện. Body/WPS timeline và thời điểm hiệu ứng lấy từ client 4.0.3; sprite sheet x4 được kiểm tra hash và frame geometry trong `reference/hso403/client.json`.

| Phái | Chiêu #2 | Internal skill | Effect | Tick phát hiệu ứng | Sprite client |
|---|---|---:|---:|---:|---|
| Chiến binh | Hỏa kiếm | 41 | 52 | 9 | `110_83`, `110_68` |
| Sát thủ | Độc kiếm | 36 | 46 | 9 | `110_70`, `110_72` |
| Pháp sư | Đá tuyết | 20 | 25 | 9 | `110_57`, `110_3` |
| Xạ thủ | Phóng điện | 18 | 22 | 4 | `110_74` |

Preview phát lại một mục tiêu đứng yên qua bốn hướng. Hạt ngẫu nhiên, sát thương, âm thanh, cooldown và mục tiêu di chuyển chưa được mô phỏng; clip thư viện part chỉ giữ timeline cơ thể.

Phạm vi hiện tại: thân, WPS, hiệu ứng chính và nổ đạn. Chưa có tia tụ lực trước đòn, bụi đá/rung màn hình, tương tác nước, sát thương và âm thanh. Hiệu ứng nằm trong khung preview riêng; xuất tư thế vẫn lấy nhân vật/vũ khí, thư viện part xuất timeline thân #1 nhưng không đóng gói hiệu ứng/weapon runtime. Tải lại trang sau khi thay đổi dữ liệu hoặc giao diện.

## Preview chiêu #3

Chọn **Kỹ năng server → #3** cùng vũ khí thường để xem nhánh theo phái. Timeline thân/WPS lấy từ `SplashSkill`; hiệu ứng chính dùng các sprite client `110_8/53`, `110_50`, `110_23/24`, `110_31/97`.

| Phái | Chiêu #3 | Internal skill | Effect | Tick hiệu ứng | Plash |
|---|---|---:|---:|---:|---:|
| Chiến binh | Rồng đất | 21 | 26 | 11 | 5 |
| Sát thủ | Tia chớp | 22 | 27 | 9 | 1 |
| Pháp sư | Sóng xung kích | 39 | 49 | 11 | 5 |
| Xạ thủ | Súng phóng lựu | 24 | 31 | 5 | 5 |

Preview theo mục tiêu tĩnh chỉ tái hiện sprite/đường bay chính. Hiệu ứng phụ ngẫu nhiên, sát thương, âm thanh, cooldown và gameplay chưa mô phỏng; các kích thước frame và mapping client lưu tại `reference/hso403/client.json`.

## Preview chiêu #4

Chọn **Kỹ năng server → #4** cùng vũ khí thường để xem nhánh theo phái. Ba phái đầu dùng plash 5; Xạ thủ dùng raw plash/frame 6/11, được client chia đôi thành plash 3/tick 5 và có chuỗi body/WPS riêng.

| Phái | Chiêu #4 | Internal skill | Effect | Tick hiệu ứng | Plash sau xử lý |
|---|---|---:|---:|---:|---:|
| Chiến binh | Thiên thạch | 5 | 11 | 11 | 5 |
| Sát thủ | Xúc tu gai độc | 37 | 47 | 11 | 5 |
| Pháp sư | Rồng băng giá | 51 | 64 | 11 | 5 |
| Xạ thủ | Tia công phá | 40 | 51 | 5 | 3 |

Khung xem dùng sprite chính của effect client và mục tiêu tĩnh. Hạt phụ ngẫu nhiên, sát thương, âm thanh và cooldown chưa mô phỏng.

## Thú cưỡi và thú cưng

Đã có hai bộ chọn riêng trong phần thay bộ phận: 14 ngoại hình thú cưỡi sheet thường và 6 pet cơ bản, gồm **Ngựa nâu + Cú**, ưu tiên PNG x4 gốc. Có đứng/đi bốn hướng, frame/điểm ngồi/layer đối chiếu client4.0.3. Xuất thư viện part bổ sung folder `mounts/<id>/`, `pets/<id>/` và API `character.mount(id)` / `character.setPet(id)`; vẫn giữ cấu trúc v1.

Pet đang dùng đội hình xem trước, chưa có AI đi theo/chiến đấu. 13 rig sheet thường đã hỗ trợ các chiêu đánh #0–#8, #17, #19, #20 của bốn phái khi chọn vũ khí thường; Ngựa nâu bị client cấm đánh, rig hiệu ứng đặc biệt chưa hỗ trợ. Demo arena H5 chưa dùng rig thú. Các rig chưa xác minh nằm trong báo cáo, không tạo asset thay thế. Xem [nguồn đối chiếu, cách dùng và thay PNG HD](docs/companions-v1.md).

Để thử đánh khi cưỡi: **chọn một trong 13 rig được phép (ví dụ Ngựa trắng, Ngựa chiến giáp, Tuần lộc, Sói xám, Sư tử, Heo rừng, Con lân) + vũ khí thường → Tấn công → chọn chiêu đánh**. Thú giữ frame/điểm ngồi từ lúc bắt đầu đòn, thân và WPS chạy theo client4.0.3. Xuất thư viện ở trạng thái này để có clip thân của chiêu đang chọn khi cưỡi; thư viện vẫn chưa equip texture vũ khí.

Khi cưỡi, chiêu #1–#4 có khung hiệu ứng chính đã khôi phục; #5–#8/#17/#19/#20 hiện hiển thị timeline thân/WPS, chưa khẳng định hiệu ứng đầy đủ nguyên bản. Các ô nội tại/buff không nằm trong danh sách đòn đánh.
