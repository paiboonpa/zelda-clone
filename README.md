# Game reference preparation

Reference analysis for a browser-based 3D action-adventure reconstruction from the supplied battle and exploration recordings.

Read [the implementation preparation brief](docs/clone-preparation.md). Open the reference viewer by running:

```sh
cd /Volumes/Development/zelda-clone
python3 -m http.server 8000 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8000. Includes all 15,703 frames, original recordings, audio extracts, metadata, contact sheets, frame stepping, and exportable notes. The playable game lives in `game/` (see below).

To regenerate the pack, install Pillow and numpy in your preferred Python environment and ensure ffmpeg/ffprobe are on PATH, then run `python3 tools/decompose.py`. Source paths are configured in that script. Extraction uses full-resolution JPEGs; original MP4 copies preserve source fidelity. The pack uses several gigabytes; keep the frame directory out of source control if you initialize a repository.

Walk extraction edit: source frames 1–2 were deleted. Remaining extracted frames are renumbered from 1 (original source frame 3), with source timestamps retained. Original MP4 and audio are unchanged. `reference/edits.json` preserves the removal when regenerating.

## Playable game: Verdant Hollow

An original browser action-adventure built from the systems in the brief: third-person controller and camera, lock-on targeting, sword combos, charged spin attack, shield blocking and seed reflection, dodge, jump/ledges, lift and throw, dialogue with choices, shop, chests, pickups, HUD with hearts/gems/minimap, a companion wisp, and six scenes (forest village, shop, root hollow, open field, desert basin, market town). Models, textures (generated procedurally at load) and audio (synthesized with Web Audio) are all original; scene palettes were tuned against average colors sampled from the reference frames.

```sh
python3 tools/serve.py 8124
```

Then open http://127.0.0.1:8124/game/. Three.js is loaded from unpkg, so the first load needs network access. Progress saves to localStorage.
