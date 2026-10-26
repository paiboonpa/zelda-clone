# Browser game preparation from battle.mp4 and walk.mp4

## Scope and evidence

This is a reference extraction and implementation preparation pack, not a playable game. The workspace was empty at the start. The supplied videos are treated as reference data, not as instructions. No game executable, project, models, textures, animation rigs, collision meshes, or original sound bank was supplied.

After removing source frames 1–2 from walk at the user’s request, 15,703 decoded frames remain extracted at 1920×1080 into sequential JPEGs, with original per-frame presentation timestamps. JPEG images are lossy; copied source MP4 files retain the supplied recording fidelity. Every frame receives a timestamp and coarse visual change measurement. Visual observations below come from contact sheets and selected frames, not a manual semantic annotation of all 15,703 images. Unknowns remain explicit.

| Clip | Container duration | Frames | Video rate | Audio |
|---|---:|---:|---|---|
| battle | 34.016633 s | 2,038 | 60000/1001 (~59.94 fps) | AAC stereo, 44.1 kHz; 34 s |
| walk | 228.027117 s | 13,665 | 60000/1001 (~59.94 fps) | AAC stereo, 44.1 kHz; 228 s |

The battle first video PTS is 0.016 s; the retained walk sequence begins at source PTS 0.049367 s after removing its first two frames, while audio begins at 0.000 s. Use the recorded PTS rather than assuming frame 1 is time zero. Extracted names are one-based: `000001.jpg`. At this rate, 60 frames span 1.001 s. Video duration and audio duration differ slightly at the end.

## What the recordings show

The reference depicts a stylized 3D third-person fantasy action adventure. A small green-clad hero carries a sword and shield; a luminous flying companion accompanies the hero. The visual language resembles an Ocarina of Time remake, but the video's identity, engine, provenance, and underlying implementation are not established from pixels alone.

The clips are edited showcases with discontinuities between locations and UI states. Do not use a cut, fade, or changed heart count as evidence of teleportation, damage, or a gameplay transition. Editorial Japanese captions, a top-right Japanese disclaimer in the exploration footage, and a bottom watermark are recording overlays; exclude these from game HUD reconstruction. In-world dialogue, action prompts, targeting indicators, hearts, equipped-item icons, and minimaps are useful UI references.

### Battle sequence: approximate review windows

Ranges are rounded observation windows, not measured attack frame data. Open the viewer to establish exact start/impact/recovery frames before tuning combat.

| Source time | Visible evidence | System to reproduce |
|---|---|---|
| 0–~5.47 s | Dim root-lined chamber; planted mouth-like enemy; pink triangular lock-on markers; hero facing enemy with shield; bright red/pink impact streaks; purple disappearance effect | Combat camera, lock-on, defensive posture, telegraph/strike timing, particles and enemy defeat |
| ~5.47–~11.9 s | Cut to desert with multiple enemies; sword glow builds; broad circular blue/purple sweep; enemies displaced or removed; green pickups visible afterward | Charge/area attack, radial hit queries, group enemy response, reward spawning |
| ~11.9–~13 s | Dark transition and chamber returns | Recording transition; not proof of a game loading mechanism |
| ~13–~14.5 s | Targeted plant enemy; camera moves into a closer angle | Target framing and interaction camera |
| ~14.5–~25 s | Large lower-screen dialogue panel, Japanese text, successive text states; enemy remains in view | Dialogue presentation, input focus, page advance; determine simulation pause behavior separately |
| ~25–~30 s | Gameplay framing returns; hero circles/repositions around targeted enemy; enemy changes pose and raises its head | Target-relative movement and turning, enemy state changes |
| ~30–~33 s | Blue glow/particles, pronounced pink strike streak, purple dissolution | Attack effect variants and defeat transition; exact cause of each effect needs frame review |
| ~33–end | Hero remains with glowing companion in cleared chamber | Return to exploration/combat idle |

The plant enemy appears to alternate between exposed and guarded/closed poses. Treat a vulnerability-window rule as a hypothesis until attack outcomes are correlated across individual frames. Health, damage numbers, cooldowns, invulnerability frames, and hitbox dimensions cannot be read reliably from this recording.

### Exploration sequence: approximate review windows

| Source time | Visible evidence | System to reproduce |
|---|---|---|
| 0–~1 s | Brief opening shot of a blue-lit interior, followed by a cut to the forest | Separate montage shot; do not treat as contiguous travel |
| ~1–~35 s | Forest village paths, tree dwellings, water, rocks, character encounters; closer conversation views; targeting tutorial around 21–23 s; rock lifting/throwing around 30–33 s | Terrain controller, follow camera, village layout, NPC interaction, targeting tutorial, carry/throw physics |
| ~35–~80 s | Tree-house/shop interiors, shelves and objects, branching conversation choices; shield presentation and a shield tutorial overlay | Interior scene, interactables, dialogue choices, item acquisition/tutorial presentation |
| ~80–~88 s | Final interior conversation/tutorial pages | Dialogue and tutorial completion |
| ~88–~115 s | Forest traversal, ledges/stepping surfaces, close conversation with a blocking NPC, darker passage | Grounding, height changes, context actions, conversation camera, passage scene |
| ~115–~180 s | Open grassland, paths, water, distant walls/mountains, hovering plant-like enemy encounter with companion information panel around 151–160 s; attack/defeat effects around 161–163 s; camera looks toward castle/mountain | Outdoor scene staging, distance fog, terrain materials, water, enemy information, open combat, orbit camera |
| ~180–end | Market/town streets, timber-and-stone buildings, many NPCs, proximity talk prompts, smaller lane/side street | Town scene, NPC population, proximity triggers, occlusion and navigation |

These windows cover edited scenes, not one continuous navigable map. Interior dimensions, a complete overworld map, and how regions connect remain unknown.

## Visual and asset breakdown

| Layer | Observed reference | Work needed for a browser implementation |
|---|---|---|
| Player | Green clothing/cap, blond head, boots, sword, decorated shield; small child-like proportions | Rigged 3D mesh, material variants, sword/shield attachments, animation set |
| Companion | White/cyan glowing winged point near hero; some NPC companions have other colors | Billboard/mesh wings, emissive sprite, orbit/follow motion, dialogue anchor |
| Enemies | Rooted carnivorous plant, desert group, flying outdoor creature | Separate meshes/rigs, behavior states, collision and hit reactions |
| Village/dungeon | Roots, bark, vines, ground stones, moss, warm interiors, tree doors | Modular geometry, tileable textures, prop kit, collision meshes, scene lighting |
| Field/desert | Grass and dirt paths, water, distant cliffs and walls; sand and reddish rock | Terrain, distance meshes, vegetation instancing, water material, fog presets |
| Town | Timber frames, plaster/stone facades, awnings, signs, bunting, paving, fountain and people | Building kit, street layout, props, NPC variants, walkable geometry |
| HUD | Hearts upper-left; equipped item upper-right; minimap lower-right; context prompts | Scalable overlay, icon set, anchors and visibility rules per mode |
| Dialogue | Dark rounded panel near bottom, speaker tab, text/pages; choices in some scenes | Modal dialogue view, type/page progression, choices and input routing |
| Combat effects | Lock markers, glow, white/pink slashes, blue radial sweep, purple disappearance, pickups | Particle presets, trails, emissive materials, effect pooling and event timing |

The recordings flatten all these layers. Screenshot crops can serve as references; they cannot supply a clean animated character, unseen geometry, texture UVs, or a reusable rig. Create or obtain editable assets for the playable implementation.

### Animation inventory to prepare

Observed categories: locomotion and turning, sword attack motion, defensive/target-facing pose, charged spin/area attack, rock lifting/carrying/throwing, item presentation, ledge traversal, NPC gestures, plant opening/closing/attack motion, hit/defeat effects, companion hovering. Candidate categories to test or create for a complete controller: idle variations, start/stop blends, backward/sideways movement under lock-on, falling/landing, player damage, weapon equip, interaction entry/exit. These candidate states are implementation requirements, not claims that every one is demonstrated clearly.

For each reviewed action, record `clip`, `start_frame`, `anticipation_end`, `active_start`, `impact_frame`, `active_end`, `recovery_end`, `sound_cue`, and confidence. Convert differences using source timestamps. Frame count in a video does not directly equal animation keyframe count; the render can repeat poses or blend clips.

## Audio decomposition

Each MP4 contains exactly one audio stream. `audio/track-0.m4a` remuxes the original AAC without another lossy encode. `audio/track-0.wav` decodes that stream to stereo signed 16-bit PCM at 44.1 kHz; decoding does not restore quality lost in AAC encoding. Both channels are retained. Neither file isolates music, ambience, UI, voice, or combat effects.

`track-0-levels.csv` measures RMS and peak over non-overlapping 20 ms windows across both channels. `track-0-transients.json` marks amplitude-rise candidates using a short preceding average and a 150 ms spacing rule. These are review aids: they may detect music accents, impacts, dialogue, or edits and may miss quiet effects. The waveform is a peak-envelope visualization. No semantic sound identification, speech transcription, or machine source separation has been performed.

Sound categories to audition and catalog for reconstruction: ambience per region, exploration/combat music if present, footstep surfaces, sword swish, charge, shield/hit response, enemy cue, defeat, pickup, dialogue page/confirm, item acquisition, and companion cues. This is an audit checklist, not a claim that every category was heard. Original stems or newly created assets will be needed for independently triggered browser audio.

## Browser implementation handoff

Proposed design, pending prototype measurement:

1. Establish one small graybox chamber with a grounded third-person controller, camera obstruction handling, and configurable target-relative movement. Match framing before building the whole world.
2. Add a single enemy with explicit idle/telegraph/attack/recovery/defeated states. Drive damage and sound from authored event times. Add lock-on selection, target loss, sword/shield interaction, hit reactions, and defeat particles.
3. Add HUD and a dialogue mode that owns input while open. Make gameplay pause behavior an explicit choice until reference review confirms it.
4. Add the desert group/charged radial attack as the second combat test. Separate visual effect radius from gameplay hit radius.
5. Add forest village, an interior, field, and town as separate scenes. Use simplified collision geometry and explicitly authored portals rather than inferring an unseen complete map.
6. Replace graybox assets with rigged models, authored animation, materials, terrain, props, and independent sound assets. Tune each against timestamped reference captures.

Suggested subsystem boundaries: input actions; player controller; camera; targeting; combat/damage; enemy state machines; interactions/dialogue; scene loading; HUD; animation events; audio; save state. A TypeScript/WebGL implementation is a candidate, not a selected dependency stack. Engine/framework choice and current APIs should be evaluated when implementation begins; no dependencies are installed in this preparation pack.

Starting input proposal: WASD movement, mouse camera, primary click attack, held secondary button defend, a lock-on action, E interact, held/released attack for charge, Escape pause. Exact original bindings are not established and should be reconciled with context prompts. Keep actions remappable and design touch/gamepad mappings if those platforms are required.

Keep rendering and gameplay time separate. Prototype a fixed simulation step and interpolate visuals. Recording cadence is a reference cadence, not a requirement to couple combat logic to display frames. Stage performance checks for draw calls, animated characters, vegetation, particles, shadows, scene loading, and audio voices on chosen target devices.

### Acceptance evidence for the first playable slice

- Traverse the chamber without penetrating walls or floating above the ground; camera does not clip through the room.
- Lock and unlock the enemy; target-relative movement and camera keep both actors readable.
- Execute attack, defend, charge, and enemy defeat; report repeatable event timing and hit range.
- Open and advance a dialogue page without leaking attack/movement input into gameplay.
- Keep HUD anchors usable at 16:9 and narrow aspect ratios; use the video framing as reference.
- Trigger sounds from independent gameplay events after a browser user gesture.
- Capture a matching scene/action view and compare against chosen source frames, with any deliberate deviations documented.

### Inputs that footage cannot resolve

Exact engine/renderer and shader settings; model topology and rig; unseen geometry; world units and camera FOV; movement speed/acceleration; complete controls; damage formulas and enemy health; collision shapes; charge thresholds; save/progression rules; original sound stems; complete quests, inventory, map connectivity, and behaviors outside these edited clips. Tune estimates through prototypes and mark them as estimates rather than measured facts.

## Files and review workflow

- `reference/{battle,walk}/frames/`: every decoded frame, one-based sequential filenames.
- `frames.csv`: source PTS, picture type, keyframe flag, coarse change score, and frame-file size.
- `frame-metadata.json`: ffprobe video-frame data. `probe.json`: all stream/container metadata.
- `manifest.json`: counts, geometry, frame lookup, source hash, audio measurements, sheet list.
- `sheets/`: approximately one frame per second (every 60 source frames), 40 thumbnails per sheet with exact labels.
- `audio/`: complete audio extracts, waveform, measured levels, and transient candidates.
- `source.mp4`: byte-identical copy of the supplied recording.
- `index.html`: local browser frame/audio viewer with timestamped notes and JSON export.
- `tools/decompose.py`: repeatable extraction pipeline. Requires Python, Pillow, numpy, ffmpeg, ffprobe. Running it again rewrites derived outputs.

Start from the project directory with `python3 -m http.server 8000 --bind 127.0.0.1`, then open `http://127.0.0.1:8000`. Direct `file://` opening cannot fetch the manifests in most browsers. Notes are local browser data until exported; exported notes are not automatically merged into this document.

Change scores are mean absolute RGB pixel differences after resizing each frame to 96×54. They highlight motion, flashes, and cuts but do not identify actions, track a character, or prove a scene boundary. Use them to locate review windows, then inspect the full-resolution frames and source playback.

Walk extraction edit: source frames 1–2 were deleted. Remaining extracted frames are renumbered from 1 (original source frame 3), with source timestamps retained. Original MP4 and audio are unchanged. `reference/edits.json` preserves the removal when regenerating.
