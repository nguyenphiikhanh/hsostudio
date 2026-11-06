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
Three columns: catalog, character/library workspace, draft inspector. Within the character workspace, part selectors sit beside a centered pixel preview at desktop widths; stack them below 850px. Open with a standing character at 6x zoom. A four-column strip below shows front, back, right and left; the active direction has a green border. Idle/walk, playback, stepping and fps controls sit above the strip. At mobile widths the direction strip becomes two columns. Raw assets remain below the character editor. Stack the main columns on narrow screens.
## Elevation & Depth
Borders separate panels; no decorative shadows.
## Components
A labeled export-name field in the header shows the resulting ZIP filename. Export downloads a single archive. Visible keyboard focus, labeled inputs, paginated asset gallery, explicit loading and failure states.
## Do's and Don'ts
Pixelated rendering. Never claim inferred frame layouts are original game animations.

## H5 playtest
Open the playable arena in a full-screen dialog above Studio. Reuse the dark panel colors and green accent. A compact HUD shows HP and the five-enemy objective; controls remain visible above the pixel-art canvas. Canvas scales to the available area while preserving its aspect ratio. The arena uses muted green ground, brown paths, stone obstacles and readable slime silhouettes drawn in code. Character textures come from the existing HSO part composition. Loading, pause, defeat and victory states have clear actions. Desktop keyboard input is the first supported control scheme.

## Library export
The header offers a separate “Xuất thư viện part” action alongside the existing single-pose export. Reuse the export-name field and disable exports during packaging. Report progress in the status area. The package contains supported character parts with original x4 textures where valid, independent folders per slot/part (sheet.png, editable part.json and generated atlas.json), equipment/animation metadata, the selected outfit, and a self-contained Phaser runtime. Clearly identify supported idle/walk previews and excluded weapons, pets, mounts and attack animations.


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
