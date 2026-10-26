#!/usr/bin/env python3
"""Validate extraction coverage, image headers, timestamps, copies, and audio."""
import csv
import hashlib
import json
import wave
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
results = []
for name, expected in [('battle', 2038), ('walk', 13665)]:
    folder = ROOT / 'reference' / name
    manifest = json.loads((folder / 'manifest.json').read_text())
    metadata = json.loads((folder / 'frame-metadata.json').read_text())
    rows = list(csv.DictReader((folder / 'frames.csv').open()))
    images = sorted((folder / 'frames').glob('*.jpg'))
    assert len(images) == len(rows) == len(metadata) == len(manifest['frames']) == expected
    last_pts = -1
    for index, (path, row, frame) in enumerate(zip(images, rows, metadata), 1):
        assert path.name == f'{index:06d}.jpg'
        assert int(row['frame']) == index
        assert path.stat().st_size == int(row['bytes'])
        pts = float(row['pts_seconds'])
        assert pts == float(frame['best_effort_timestamp_time'])
        assert pts > last_pts
        last_pts = pts
        with Image.open(path) as im:
            assert im.size == (1920, 1080)
            im.verify()
    source_hash = hashlib.file_digest((folder / 'source.mp4').open('rb'), 'sha256').hexdigest()
    assert source_hash == manifest['source_sha256']
    for track in manifest['audio']:
        with wave.open(str(folder / 'audio' / f'track-{track["index"]}.wav'), 'rb') as wav:
            assert wav.getnchannels() == track['channels'] == 2
            assert wav.getframerate() == track['sample_rate'] == 44100
            assert wav.getnframes() == track['samples']
    for sheet in manifest['sheets']:
        assert (folder / sheet).is_file()
    results.append({'clip': name, 'frames_verified': expected, 'resolution': [1920,1080], 'first_pts': float(rows[0]['pts_seconds']), 'last_pts': last_pts, 'copied_source_sha256_matches': True, 'audio_tracks_verified': len(manifest['audio']), 'contact_sheets': len(manifest['sheets'])})
report = {'status': 'pass', 'total_frames_verified': sum(x['frames_verified'] for x in results), 'clips': results}
(ROOT / 'reference' / 'verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
