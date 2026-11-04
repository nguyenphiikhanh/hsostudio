# H5 playable prototype

Accepted direction: new game using HSO character assets; desktop first; single-player first.

Studio remains the design tool. The prototype opens in an isolated overlay, lazily loads Phaser, and consumes a snapshot of the current character layers. No connection to the legacy Java server and no persistence. The first arena and slime enemies are original code-drawn placeholders, not decoded HSO maps or monsters.

Scope: one bounded arena, obstacles/collision, normalized eight-direction movement with four-direction sprite facing, standing/walking animation, Space melee, enemy chase/contact damage, HP, kill objective, pause/resume and restart. Foreground assets are loaded before the game starts. Escape pauses; tab hiding pauses. Closing destroys Phaser and releases keyboard listeners.

Next milestones: validate original map decoding, add authenticated animation definitions and weapon attacks, then consider inventory/progression and a server. No online authority or account system in this prototype.
