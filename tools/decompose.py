#!/usr/bin/env python3
"""Reproducible local reference extraction. Requires ffmpeg, ffprobe, Pillow, numpy."""
import csv
import hashlib
import json
import subprocess
import wave
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {name: Path('/Volumes/Development/test2') / f'{name}.mp4' for name in ('battle', 'walk')}

def run(args):
    return subprocess.run(args, check=True, capture_output=True).stdout

def extract(item):
    name, source = item
    out = ROOT / 'reference' / name
    for sub in ('frames', 'sheets', 'audio'):
        (out / sub).mkdir(parents=True, exist_ok=True)
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)]))
    (out / 'probe.json').write_text(json.dumps(probe, indent=2))
    # Preserve a portable copy of the original container without re-encoding.
    if not (out / 'source.mp4').exists():
        import shutil
        shutil.copy2(source, out / 'source.mp4')
    frames = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,pkt_duration_time,key_frame,pict_type', '-of', 'json', str(source)]))['frames']
    edits_path = ROOT / 'reference' / 'edits.json'
    edits = json.loads(edits_path.read_text()) if edits_path.exists() else {}
    drop = edits.get(name, {}).get('drop_leading_frames', 0)
    print(f'{name}: extracting {len(frames)} frames', flush=True)
    run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-map', '0:v:0', '-fps_mode', 'passthrough', '-q:v', '2', str(out / 'frames' / '%06d.jpg')])
    if drop:
        extracted = sorted((out / 'frames').glob('*.jpg'))
        for file in extracted[:drop]:
            file.unlink()
        for number, file in enumerate(extracted[drop:], 1):
            file.rename(out / 'frames' / f'{number:06d}.jpg')
        frames = frames[drop:]
    (out / 'frame-metadata.json').write_text(json.dumps(frames, indent=2))
    audio_streams = [s for s in probe['streams'] if s['codec_type'] == 'audio']
    audio_summary = []
    for n, stream in enumerate(audio_streams):
        base = out / 'audio' / f'track-{n}'
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-map', f'0:{stream["index"]}', '-c:a', 'copy', str(base.with_suffix('.m4a'))])
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-map', f'0:{stream["index"]}', '-c:a', 'pcm_s16le', str(base.with_suffix('.wav'))])
        with wave.open(str(base.with_suffix('.wav')), 'rb') as wav:
            rate, channels = wav.getframerate(), wav.getnchannels()
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32).reshape(-1, channels) / 32768
        windows = []
        step = int(rate * .02)
        for i in range(0, len(samples), step):
            x = samples[i:i+step]
            windows.append({'time': round(i/rate, 5), 'rms': round(float(np.sqrt(np.mean(x*x))), 6), 'peak': round(float(np.max(np.abs(x))), 6)})
        with (out / 'audio' / f'track-{n}-levels.csv').open('w') as f:
            writer = csv.DictWriter(f, fieldnames=['time', 'rms', 'peak']); writer.writeheader(); writer.writerows(windows)
        # Candidate transients are amplitude rises, not semantic sound labels.
        candidates = []
        for i in range(5, len(windows)):
            previous = np.mean([w['rms'] for w in windows[i-5:i]])
            if windows[i]['rms'] > max(.025, previous * 1.8) and (not candidates or windows[i]['time'] - candidates[-1]['time'] > .15):
                candidates.append(windows[i])
        (out / 'audio' / f'track-{n}-transients.json').write_text(json.dumps(candidates, indent=2))
        width, height = 1600, 240
        im = Image.new('RGB', (width, height), '#101b23'); draw = ImageDraw.Draw(im)
        for x in range(width):
            lo, hi = int(x*len(windows)/width), max(int((x+1)*len(windows)/width), int(x*len(windows)/width)+1)
            peak = max((w['peak'] for w in windows[lo:hi]), default=0)
            draw.line((x, height/2-peak*100, x, height/2+peak*100), fill='#64dfb6')
        im.save(out / 'audio' / f'track-{n}-waveform.png')
        audio_summary.append({'index': n, 'channels': channels, 'sample_rate': rate, 'samples': len(samples), 'duration': len(samples)/rate, 'transient_candidates': len(candidates)})
    files = sorted((out / 'frames').glob('*.jpg'))
    assert len(files) == len(frames), (name, len(files), len(frames))
    rows = []
    previous = None
    thumbs = []
    for i, (file, metadata) in enumerate(zip(files, frames)):
        with Image.open(file) as im:
            small = im.resize((96, 54)).convert('RGB')
            pixels = np.asarray(small, dtype=np.float32)
            delta = float(np.mean(np.abs(pixels-previous))) if previous is not None else 0
            previous = pixels
            if i % 60 == 0:
                thumb = im.copy(); thumb.thumbnail((320, 180)); thumbs.append((i+1, float(metadata['best_effort_timestamp_time']), thumb))
        rows.append({'frame': i+1, 'pts_seconds': metadata['best_effort_timestamp_time'], 'file': f'frames/{file.name}', 'picture_type': metadata.get('pict_type'), 'key_frame': metadata.get('key_frame'), 'change_score': round(delta, 4), 'bytes': file.stat().st_size})
    with (out / 'frames.csv').open('w') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    sheets = []
    for start in range(0, len(thumbs), 40):
        page = Image.new('RGB', (1600, 8*206), '#101b23'); d = ImageDraw.Draw(page)
        for j, (frame, pts, thumb) in enumerate(thumbs[start:start+40]):
            x, y = (j%5)*320, (j//5)*206
            page.paste(thumb, (x,y)); d.text((x+6,y+184), f'{name}  {pts:.3f}s  #{frame}', fill='white')
        filename = f'sheets/{start//40+1:03d}.jpg'; page.save(out / filename, quality=88); sheets.append(filename)
    summary = {'name': name, 'source': str(source), 'source_sha256': hashlib.file_digest(source.open('rb'), 'sha256').hexdigest(), 'frame_count': len(files), 'width': probe['streams'][0]['width'], 'height': probe['streams'][0]['height'], 'fps': probe['streams'][0]['avg_frame_rate'], 'duration': float(probe['format']['duration']), 'first_pts': float(rows[0]['pts_seconds']), 'last_pts': float(rows[-1]['pts_seconds']), 'frame_encoding': 'JPEG quality 2; every decoded frame at source resolution; lossy reference images', 'audio': audio_summary, 'sheets': sheets, 'frames': [{'frame':r['frame'], 'time':float(r['pts_seconds']), 'change':r['change_score']} for r in rows]}
    if drop:
        summary['excluded_source_frames'] = list(range(1, drop + 1))
    (out / 'manifest.json').write_text(json.dumps(summary))
    print(f'{name}: verified {len(files)} frames, {len(sheets)} sheets, {len(audio_summary)} audio tracks', flush=True)
    return summary

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        summaries = list(pool.map(extract, SOURCES.items()))
    (ROOT / 'reference' / 'manifest.json').write_text(json.dumps([{k:v for k,v in s.items() if k!='frames'} for s in summaries], indent=2))
