---
name: HSO Asset Workbench
colors:
  primary: "#b9e581"
  surface: "#202326"
  canvas: "#17191b"
  on-surface: "#e8ece5"
  muted: "#a6afa8"
  border: "#383e39"
typography:
  headline: {fontFamily: system-ui, fontSize: 24px, fontWeight: 600, lineHeight: 1.2}
  body: {fontFamily: system-ui, fontSize: 14px, fontWeight: 400, lineHeight: 1.5}
  label: {fontFamily: monospace, fontSize: 12px, fontWeight: 400, lineHeight: 1.4}
rounded: {sm: 4px, md: 8px}
spacing: {sm: 8px, md: 16px, lg: 24px}
---
## Overview
A dense Vietnamese game asset workbench. Native controls, dark neutral surfaces, green selection.
## Layout
Desktop/laptop workspace with a compact left navigation rail, flexible central preview/browser and a contextual right panel. Character Lab uses one main viewport, four direction thumbnails and the Trang bị / Animation / Tinh chỉnh tabs. Catalog owns category/filter/gallery controls and record details. Map owns its tool palette, canvas, inspector and export toolbar. Keep long controls in independently scrolling panels. See Desktop workspace redesign below for dimensions and breakpoints.
## Elevation & Depth
Borders separate panels; no decorative shadows.
## Components
A labeled export-name field in each applicable route toolbar shows the resulting ZIP filename. Export downloads a single archive. Visible keyboard focus, labeled inputs, paginated asset gallery, explicit loading and failure states.
## Do's and Don'ts
Pixelated rendering. Never claim inferred frame layouts are original game animations.

## H5 playtest
Open the playable arena in a full-screen dialog above Studio. Reuse the dark panel colors and green accent. A compact HUD shows HP and the five-enemy objective; controls remain visible above the pixel-art canvas. Canvas scales to the available area while preserving its aspect ratio. The arena uses muted green ground, brown paths, stone obstacles and readable slime silhouettes drawn in code. Character textures come from the existing HSO part composition. Loading, pause, defeat and victory states have clear actions. Desktop keyboard input is the first supported control scheme.

## Library export
Character Lab offers a separate “Xuất thư viện part” action alongside the existing single-pose export. Reuse the export-name field and disable exports during packaging. Report progress in the status area. The package contains supported character parts with original x4 textures where valid, independent folders per slot/part (sheet.png, editable part.json and generated atlas.json), equipment/animation metadata, the selected outfit, and a self-contained Phaser runtime. Clearly identify supported idle/walk previews and excluded weapons, pets, mounts and attack animations.


## Character texture quality
Prefer original x4 PNGs for character previews and library export. Keep positions/crops in logical x1 units and convert crops to physical texture pixels using per-part density. Canvas backing resolution is four times its logical size. Display an explicit reason for each x1 fallback; never call a mislabeled or enlarged x1 sheet original x4 art. Retain the independent v1 part folders.

## Attack investigation preview
Use the existing animation state selector for “Tấn công · thử nghiệm”. An inline panel above the four direction canvases shows class/skill/level selectors and original server fields with packet provenance. Separate pose and anchor selectors expose the unverified crop-to-anchor binding. Keep the existing colors, spacing, labeled inputs and FPS/pause/step controls. Always distinguish original sprite crops from the trial sequence and timing; no generated weapon art or guessed effect binding. Changing class changes server evidence, not a claim of a recovered class-specific animation.

## Verified weapon equipment records
Keep the class selector synchronized with the attack lab. Show actual item3 weapon templates filtered by class, with a character-level check. Separate ordinary weapons (types 8–11, wear[0]) from cosmetic weapons (type 24, wear[17]). Show original item IDs, part IDs and verified cosmetic appearance ID (part+41). Do not offer sheet families as equippable items, editable hand offsets or guessed direction groups. Explicitly state that rendering remains unavailable until the item-to-texture and binding mappings are verified. Selecting a record adds no rendered layer or exported sprite.

## Client-verified ordinary weapon rendering
Actual item selection drives a verified 4.0.3 renderer, not editable arbitrary sheet bindings. Basic attack with a selected ordinary weapon has a visible client/version badge, fixed 25FPS and original WPS frames; hide manual pose controls in that mode. Other skills remain marked trial and do not draw unverified weapons. Display WPS x1 quality explicitly. Cosmetic weapon selection remains metadata-only. Keep provenance/version and export limitations visible.

## Companion selectors
Place the Mount and Pet selectors below verified weapon controls, using existing field, part-selectors and muted text tokens. Default each to None. Show original quality and separate unsupported-rig details. Reuse four direction canvases with a wider logical viewport when companions are selected. State clearly that pet placement is a preview fixture, and mounted previews support idle/walk. All 13 permitted sheet mounts expose verified offensive skills #0–#8/#17/#19/#20 with a real equipped weapon; brown horse remains blocked; other skills are disabled in this mode. Explain the restriction beside the animation controls.

## Original client eyes
The eye selector uses original Java4.0.3 eye resource IDs0–15, default8, with actual crop/anchor data. Explain the x1 source quality without calling it a placeholder. Preserve optional removal and old export compatibility. Render hair before eyes and hide eyes in the rear direction per the client.

## Composite companions
Reuse the mount/pet selectors. Only show three still-unmapped items in the unsupported list, with source warnings on the selected pet when applicable. New DataSkillEff/PetTool rigs expose idle/walk; explain why mounted attack remains disabled for these rigs. Expand direction thumbnail logical bounds to include all component pieces without animation-dependent zoom changes.

Danh hiệu có bộ chọn độc lập trong trang bị, dùng cùng native select và nhãn hiện tại. Hiển thị ID vật phẩm, số frame và chất lượng x4; có “Không dùng”. Chú thích rõ đây là danh hiệu cá nhân trong bộ server, không phải bang/tổ đội. Giữ điểm đặt nguồn; các khung hướng tự thu vừa cả danh hiệu để không cắt ảnh. Demo arena chưa hỗ trợ danh hiệu; xem bằng preview hoặc ZIP Phaser.

## Navigation and routed workspaces

The left rail links to Character Lab (`/character-lab`), Thư viện dữ liệu (`/catalog`) and Map (`/maps`). Root opens Character Lab. The global header contains identity/read-only status. Character exports and H5 playtest belong to Character Lab; Catalog exposes draft ZIP export. KeepAlive retains route state; animation timers pause while the lab is inactive. Refresh clears in-memory drafts.

## Map editor

The searchable map selector distinguishes ready layouts from disabled name-only entries. Tools and native tile/object palettes sit left of the canvas; source/selected-cell/object details sit right, moving below the viewport on smaller laptops. Keep draft/native status and Undo/Redo available. Paint, erase, fill, eyedropper, collision overrides, object placement/move, duplicate/delete, reset and JSON draft import/download retain their current semantics. Palette tool buttons remain visible while scrolling. Collapse longer help/source text. Export PNG/JSON/Phaser uses the current layout and keeps explicit provenance; never replace missing source data with fabricated art. Keep camera/keyboard shortcuts, layer overlays and per-map drafts.

## Desktop workspace redesign

Desktop/laptop is the target. Preserve the native HSO art and existing dark neutral/green tokens. Use a 148px navigation rail, a flexible central workspace and a 320px context panel. A 56px application header contains identity and read-only draft status only. Export actions belong to each route, never the global header. At 1024px use a 128px rail and 290px context panel. Panels scroll independently; the canvas must remain visible while equipment changes.

Character Lab has one shared main viewport with direction thumbnails underneath. Equipment, Animation and Fine tuning are mutually exclusive tabs in the right panel. Animation state, direction and playback persist across tabs. Skill effect scenes replace the main composition viewport when available, preserving the same direction and clock. Four direction thumbnails remain for comparison. Technical provenance is available in collapsible details. Catalog has its own category bar, filters, gallery and record inspector. Map places tools/palettes in a 230px left panel, the canvas in the center and selection metadata in a 240px right panel. Save/import and export are route actions. Prefer labeled native controls, restrained borders and visible keyboard focus; no decorative motion or new imagery.

## Part design drafts

Add a collapsible Thiết kế part section inside the Equipment tab. Support pants, shirt, ordinary weapons, mounts and pets. Choose a native template, download original PNG/JSON or view/copy H5 MySQL SQL, then upload a replacement PNG with the same logical sheet layout (density x1–x4). Fields include a new design/part ID, label and a separate server item ID. Validate before changing the preview. Weapon standing/walking PNG and WPS attack PNG are separate resources; never show the template WPS as uploaded weapon art. Keep an explicit draft badge and a saved-in-tab list with preview/restore/delete actions. Download a PNG/JSON design ZIP or individual PNG/JSON; SQL is only displayed/copied; source is never mutated. JSON contains template provenance, inherited geometry and PNG hashes. MySQL targets the h5_* content contract, including asset paths, part/rig/animation metadata and optional item; state that the H5 backend must implement the renderer contract. Never write legacy item3/item4. Keep source/SQL details expandable.

## Client walking correction

Walking on foot uses client 4.0.3 A_Move/ArrMount1 body frames 2,2,2,0,0,3,3,3,0,0 at 25 FPS. The FPS selector locks in this state; restoring idle restores the prior breathing FPS. All body parts use the body-frame anchor and left-side mirror rule regardless of whether a weapon is equipped. The frame status identifies body frame and client tick; direction thumbnails share the same clock. Pet/title presence must not resample footsteps at idle FPS. Mounts retain their own original frame/seat clips. Export the same walking clip with provenance and body frame fields; H5 textures use the same anchors. Static/manual layers and front/base manual crops remain editable.

## Copy MySQL for H5 content

Part design SQL targets the new H5 MySQL content contract, not legacy item3/item4. Replace all SQL download actions with readonly, selectable SQL text and a Copy button with keyboard fallback. Provide separate one-time schema SQL and per-design registration SQL. Always show relative server PNG destinations. PNG/JSON ZIPs remain, but contain no .sql files. IDs use the H5 integer range and UTF-8 names; HSO templates remain provenance/stat sources only. Label schema/runtime requirements explicitly: registering content does not implement the future H5 server. Keep native data immutable.

Map animation controls: two desktop checkboxes, Nước động and Thác động, adjacent to map layer controls. Default off preserves static inspection. A visible quality note identifies original x1 waterfall/water fallbacks. Exported Phaser runtime retains these settings and exposes independent toggles; source layouts remain unchanged.

PNG map import: a collapsible panel above the map picker accepts one large PNG, map name, density x1–x4, and explicit transparent padding for incomplete edge cells. A scaled canvas previews the source with its 24-logical-unit grid, reporting source/padded dimensions and map cells. Creating an imported draft keeps native maps available. Imported drafts use exact-pixel tile deduplication, no inferred collision or HSO effects. Self-contained draft JSON retains the generated atlas for reopening; Phaser ZIP preserves density and atlas grid layout.
