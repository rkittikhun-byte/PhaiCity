"""
PhaiCity 6-Region Thai Music Suite Generator
============================================
Generates 18 brand new authentic regional Thai music tracks:
- 3 distinct tracks for each of the 6 regions (North, Northeast, Central, East, West, South)
- Track 1: Regional Atmosphere / Signature Melodic Heritage
- Track 2: Gentle / Serene / Contemporary Melodic
- Track 3: High-Energy, Upbeat, Festive Folk Dance / Carnival ("สนุกๆ")

Outputs:
- 16-bit 44.1kHz stereo master WAVs in assets/audio/_sources/projects/
- High-quality Vorbis .ogg files in assets/audio/music/
- SoundCraft DAW project files (.scraft) for every track in assets/audio/_sources/projects/

License: CC0 1.0 Universal (Public Domain)
"""

import os
import sys
import math
import json
import wave
import struct
import random
import subprocess

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SR = 44100
ROOT = os.path.abspath(".")
OUT_MUSIC = os.path.join(ROOT, "assets", "audio", "music")
OUT_PROJECTS = os.path.join(ROOT, "assets", "audio", "_sources", "projects")
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")

os.makedirs(OUT_MUSIC, exist_ok=True)
os.makedirs(OUT_PROJECTS, exist_ok=True)

def write_wav(path, left, right):
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        
        max_val = 1e-6
        for l, r in zip(left, right):
            al = abs(l)
            ar = abs(r)
            if al > max_val: max_val = al
            if ar > max_val: max_val = ar
            
        scale = 28000.0 / max_val
        frames = bytearray()
        for l, r in zip(left, right):
            sl = int(max(-32767, min(32767, l * scale)))
            sr = int(max(-32767, min(32767, r * scale)))
            frames.extend(struct.pack('<hh', sl, sr))
        wav.writeframes(frames)

def save_music_track(name, left, right, bpm):
    ogg_path = os.path.join(OUT_MUSIC, f"{name}.ogg")
    wav_path = os.path.join(OUT_PROJECTS, f"{name}.wav")
    
    write_wav(wav_path, left, right)
    
    cmd = [FFMPEG, "-y", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "5", ogg_path]
    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"Error encoding {name}.ogg")
    else:
        print(f"[Done] {name}.ogg -> {ogg_path}")
        
    duration = len(left) / SR
    create_soundcraft_project(name, wav_path, duration, bpm)

def create_soundcraft_project(name, wav_path, duration, bpm):
    rel_wav = os.path.basename(wav_path)
    project = {
        "format_version": 1,
        "name": name,
        "sample_rate": SR,
        "bit_depth": "Int16",
        "frame_rate": "Fps30",
        "timecode_start": 0,
        "tempo": {
            "tempos": [{"tick": 0, "bpm": float(bpm)}],
            "meters": [{"tick": 0, "numerator": 4, "denominator": 4}]
        },
        "tracks": [
            {
                "id": "track_1",
                "name": name.replace("_", " ").title(),
                "channel_format": "Stereo",
                "volume_db": 0.0,
                "pan": 0.0,
                "clips": [
                    {
                        "id": "clip_1",
                        "name": rel_wav,
                        "file": rel_wav,
                        "start_tick": 0,
                        "length_ticks": int(duration * 960 * (bpm / 60.0))
                    }
                ]
            }
        ]
    }
    proj_path = os.path.join(OUT_PROJECTS, f"{name}.scraft")
    with open(proj_path, "w", encoding="utf-8") as f:
        json.dump(project, f, indent=2)

# ==============================================================================
# SYNTHESIS INSTRUMENT ENGINES
# ==============================================================================

def add_salo(buf_l, buf_r, start_s, dur_s, freq, vol=0.4, pan=0.45):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        vib = 1.0 + 0.012 * math.sin(2 * math.pi * 5.2 * t)
        p = 2 * math.pi * freq * vib * t
        s = (math.sin(p) + 
             0.5 * math.sin(2 * p) + 
             0.3 * math.sin(3 * p) + 
             0.18 * math.sin(4 * p) + 
             0.1 * math.sin(5 * p))
        # Envelope: bow attack and singing release
        att = min(1.0, t / 0.08)
        rel = min(1.0, (dur_s - t) / 0.09) if t > dur_s - 0.09 else 1.0
        env = att * rel
        val = s * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_sueng(buf_l, buf_r, start_s, dur_s, freq, vol=0.35, pan=0.6):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        p = 2 * math.pi * freq * t
        # Plucked string with wooden resonance
        s = (math.sin(p) + 0.45 * math.sin(2 * p) + 0.25 * math.sin(3 * p) + 0.15 * math.sin(4 * p))
        decay = math.exp(-t / 0.28)
        val = s * decay * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_khaen(buf_l, buf_r, start_s, dur_s, freq, vol=0.35, pan=0.5):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        # Multi-pipe free-reed buzz with chorusing
        p1 = 2 * math.pi * (freq - 0.6) * t
        p2 = 2 * math.pi * (freq + 0.6) * t
        reed = 0.5 * (math.sin(p1) + math.sin(p2)) + 0.35 * math.sin(3 * p1) + 0.2 * math.sin(5 * p1)
        # Breath envelope
        att = min(1.0, t / 0.06)
        rel = min(1.0, (dur_s - t) / 0.08) if t > dur_s - 0.08 else 1.0
        env = att * rel * (0.9 + 0.1 * math.sin(2 * math.pi * 3.5 * t))
        val = reed * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_phin(buf_l, buf_r, start_s, dur_s, freq, vol=0.4, pan=0.38):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        # Twangy Thai lute with slight pitch hammer at onset
        pitch_bend = 1.0 + 0.02 * math.exp(-t / 0.03)
        p = 2 * math.pi * (freq * pitch_bend) * t
        s = math.sin(p) + 0.6 * math.sin(2 * p) + 0.4 * math.sin(3 * p) + 0.2 * math.sin(4 * p)
        # Fast twang decay
        env = math.exp(-t / 0.22)
        val = s * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_ponglang(buf_l, buf_r, start_s, dur_s, freq, vol=0.45, pan=0.62):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        # Resonant wooden xylophone: woody fundamental + inharmonic bar mode 2.76
        p1 = 2 * math.pi * freq * t
        p2 = 2 * math.pi * (freq * 2.76) * t
        wood = math.sin(p1) + 0.35 * math.sin(p2)
        # Transient thud
        thud = math.sin(2 * math.pi * 90 * t) * math.exp(-t / 0.015) * 0.4
        env = math.exp(-t / 0.16)
        val = (wood + thud) * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_ranat(buf_l, buf_r, start_s, dur_s, freq, vol=0.4, pan=0.5):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        # Teakwood bar struck by mallet
        p1 = 2 * math.pi * freq * t
        p2 = 2 * math.pi * freq * 2.0 * t
        p3 = 2 * math.pi * freq * 3.15 * t
        mallet = (random.random() * 2 - 1) * math.exp(-t / 0.008) * 0.3
        bar = math.sin(p1) + 0.45 * math.sin(p2) + 0.2 * math.sin(p3) + mallet
        env = math.exp(-t / 0.26)
        val = bar * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_khim(buf_l, buf_r, start_s, dur_s, freq, vol=0.35, pan=0.65):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        # Brass strings unison beating
        p1 = 2 * math.pi * freq * t
        p2 = 2 * math.pi * (freq + 0.55) * t
        p3 = 2 * math.pi * freq * 2.0 * t
        shimmer = 0.5 * (math.sin(p1) + math.sin(p2)) + 0.3 * math.sin(p3)
        strike = math.sin(2 * math.pi * 180 * t) * math.exp(-t / 0.01) * 0.2
        env = math.exp(-t / 0.5)
        val = (shimmer + strike) * env * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_khlui(buf_l, buf_r, start_s, dur_s, freq, vol=0.38, pan=0.42):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        vib = 1.0 + 0.01 * math.sin(2 * math.pi * 4.8 * t)
        p = 2 * math.pi * freq * vib * t
        breath = (random.random() * 2 - 1) * 0.04
        flute = math.sin(p) + 0.25 * math.sin(2 * p) + 0.1 * math.sin(3 * p) + breath
        att = min(1.0, t / 0.09)
        rel = min(1.0, (dur_s - t) / 0.1) if t > dur_s - 0.1 else 1.0
        val = flute * att * rel * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

def add_pi_tai(buf_l, buf_r, start_s, dur_s, freq, vol=0.42, pan=0.5):
    n = int(dur_s * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        vib = 1.0 + 0.018 * math.sin(2 * math.pi * 5.8 * t)
        p = 2 * math.pi * freq * vib * t
        # Piercing quadruple reed harmonics
        reed = (math.sin(p) + 
                0.65 * math.sin(2 * p) + 
                0.45 * math.sin(3 * p) + 
                0.3 * math.sin(4 * p) + 
                0.2 * math.sin(5 * p))
        att = min(1.0, t / 0.06)
        rel = min(1.0, (dur_s - t) / 0.08) if t > dur_s - 0.08 else 1.0
        val = reed * att * rel * vol
        buf_l[idx] += val * (1.0 - pan)
        buf_r[idx] += val * pan

# --- Percussion ---

def add_ching(buf_l, buf_r, start_s, is_ching=True, vol=0.3):
    dur = 0.6 if is_ching else 0.12
    n = int(dur * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        p1 = 2 * math.pi * 3200 * t
        p2 = 2 * math.pi * 6450 * t
        bell = (math.sin(p1) + 0.5 * math.sin(p2))
        env = math.exp(-t / (0.28 if is_ching else 0.03))
        val = bell * env * vol
        buf_l[idx] += val * 0.5
        buf_r[idx] += val * 0.5

def add_drum_bass(buf_l, buf_r, start_s, vol=0.45, freq=75):
    dur = 0.25
    n = int(dur * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        f = freq * math.exp(-t * 22)
        drum = math.sin(2 * math.pi * f * t) * math.exp(-t / 0.09)
        val = drum * vol
        buf_l[idx] += val * 0.6
        buf_r[idx] += val * 0.4

def add_drum_slap(buf_l, buf_r, start_s, vol=0.35):
    dur = 0.12
    n = int(dur * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        snap = (random.random() * 2 - 1) * math.exp(-t / 0.02)
        pop = math.sin(2 * math.pi * 320 * math.exp(-t * 40) * t) * math.exp(-t / 0.04) * 0.6
        val = (snap + pop) * vol
        buf_l[idx] += val * 0.4
        buf_r[idx] += val * 0.6

def add_bamboo_clapper(buf_l, buf_r, start_s, vol=0.35):
    dur = 0.08
    n = int(dur * SR)
    for i in range(n):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        click = (random.random() * 2 - 1) * math.exp(-t / 0.008)
        body = math.sin(2 * math.pi * 1450 * t) * math.exp(-t / 0.02)
        val = (click + body) * vol
        buf_l[idx] += val * 0.55
        buf_r[idx] += val * 0.45

# ==============================================================================
# COMPOSERS FOR THE 6 REGIONS (3 TRACKS EACH)
# ==============================================================================

def compose_track(bpm, length_sec, generator_fn):
    num_samples = int(SR * length_sec)
    buf_l = [0.0] * num_samples
    buf_r = [0.0] * num_samples
    generator_fn(buf_l, buf_r, bpm, length_sec)
    return buf_l, buf_r

# --- 1. NORTH (Lanna) ---
# Pentatonic: D4, E4, F#4, A4, B4, D5, E5
LANNA_SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25]

def gen_north_01(buf_l, buf_r, bpm, length_sec):
    # Salo & Sueng Mist (Moderate sweet Lanna)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(101)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.4
        note_idx = max(0, min(len(LANNA_SCALE) - 1, note_idx + rnd.choice([-2, -1, 0, 1, 2])))
        add_salo(buf_l, buf_r, st, dur, LANNA_SCALE[note_idx], vol=0.38, pan=0.4)
        
        # Sueng arpeggio
        if b % 2 == 0:
            st_sueng = int((b + 0.5) * beat_dur * SR)
            sfreq = LANNA_SCALE[rnd.randint(2, len(LANNA_SCALE) - 1)]
            add_sueng(buf_l, buf_r, st_sueng, beat_dur * 0.9, sfreq, vol=0.28, pan=0.65)
            
        # Gentle wood click on beat 4
        if b % 4 == 3:
            add_bamboo_clapper(buf_l, buf_r, st, vol=0.18)

def gen_north_02(buf_l, buf_r, bpm, length_sec):
    # Wiang Ping Hills (Serene mountain mist)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(102)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.8
        # Sueng lead
        note_idx = max(0, min(len(LANNA_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_sueng(buf_l, buf_r, st, dur, LANNA_SCALE[note_idx], vol=0.35, pan=0.55)
        # Salo pad sustain
        if b % 2 == 0:
            add_salo(buf_l, buf_r, st, beat_dur * 2.2, LANNA_SCALE[max(0, note_idx - 2)], vol=0.22, pan=0.35)

def gen_north_03(buf_l, buf_r, bpm, length_sec):
    # Poy Luang Carnival (Lively festive Lanna Sabatchai dance)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(103)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.75
        
        # Fast festive Salo melody
        note_idx = max(0, min(len(LANNA_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_salo(buf_l, buf_r, st, dur, LANNA_SCALE[note_idx], vol=0.42, pan=0.45)
        
        # Rapid upbeat Sueng strums (8th notes)
        st_half = int((b + 0.5) * beat_dur * SR)
        add_sueng(buf_l, buf_r, st_half, beat_dur * 0.45, LANNA_SCALE[(note_idx + 2) % len(LANNA_SCALE)], vol=0.32, pan=0.68)
        
        # Sabatchai thunder drum + bells
        if b % 2 == 0:
            add_drum_bass(buf_l, buf_r, st, vol=0.5, freq=65)
            add_ching(buf_l, buf_r, st, is_ching=True, vol=0.25)
        else:
            add_drum_slap(buf_l, buf_r, st, vol=0.4)
            add_ching(buf_l, buf_r, st, is_ching=False, vol=0.22)
            add_bamboo_clapper(buf_l, buf_r, st, vol=0.25)

# --- 2. NORTHEAST (Isan) ---
# Scale: A3, C4, D4, E4, G4, A4, C5
ISAN_SCALE = [220.0, 261.63, 293.66, 329.63, 392.00, 440.0, 523.25]

def gen_northeast_01(buf_l, buf_r, bpm, length_sec):
    # Khaen & Phin Lam Phern (Heartland tradition)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(201)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.2
        # Phin lead
        note_idx = max(0, min(len(ISAN_SCALE) - 1, note_idx + rnd.choice([-2, -1, 0, 1, 2])))
        add_phin(buf_l, buf_r, st, dur, ISAN_SCALE[note_idx], vol=0.38, pan=0.4)
        
        # Continuous Khaen drone accompaniment
        if b % 2 == 0:
            add_khaen(buf_l, buf_r, st, beat_dur * 2.1, 220.0, vol=0.22, pan=0.65)
            add_khaen(buf_l, buf_r, st, beat_dur * 2.1, 329.63, vol=0.20, pan=0.7)
            
        # Ponglang accent
        if b % 4 == 2:
            add_ponglang(buf_l, buf_r, st, beat_dur * 0.8, ISAN_SCALE[3], vol=0.3, pan=0.5)

def gen_northeast_02(buf_l, buf_r, bpm, length_sec):
    # Mekong Sunset Serenade (Gentle riverside mood)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(202)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.6
        note_idx = max(0, min(len(ISAN_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_phin(buf_l, buf_r, st, dur, ISAN_SCALE[note_idx], vol=0.35, pan=0.45)
        # Soft Ponglang wood drops
        if b % 2 == 1:
            st_p = int((b + 0.3) * beat_dur * SR)
            add_ponglang(buf_l, buf_r, st_p, beat_dur * 0.6, ISAN_SCALE[max(0, note_idx - 1)], vol=0.25, pan=0.6)

def gen_northeast_03(buf_l, buf_r, bpm, length_sec):
    # Rocket Festival Toey Samcha (Upbeat party / Bun Bang Fai dance)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(203)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.6
        
        # Rapid Ponglang sixteenth runs
        for sub in range(2):
            sub_st = int((b + sub * 0.5) * beat_dur * SR)
            p_note = ISAN_SCALE[rnd.randint(1, len(ISAN_SCALE) - 1)]
            add_ponglang(buf_l, buf_r, sub_st, beat_dur * 0.4, p_note, vol=0.38, pan=0.65)
            
        # Fast funky Phin melody
        note_idx = max(0, min(len(ISAN_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_phin(buf_l, buf_r, st, dur, ISAN_SCALE[note_idx], vol=0.42, pan=0.35)
        
        # Samcha folk percussion
        add_drum_bass(buf_l, buf_r, st, vol=0.48, freq=80)
        st_off = int((b + 0.5) * beat_dur * SR)
        add_drum_slap(buf_l, buf_r, st_off, vol=0.42)
        add_ching(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.25)

# --- 3. CENTRAL (Chao Phraya) ---
# Scale: C4, D4, E4, G4, A4, C5, D5
CENTRAL_SCALE = [261.63, 293.66, 329.63, 392.00, 440.0, 523.25, 587.33]

def gen_central_01(buf_l, buf_r, bpm, length_sec):
    # Chao Phraya Serenade (Khim & Khlui river breeze)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(301)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.5
        note_idx = max(0, min(len(CENTRAL_SCALE) - 1, note_idx + rnd.choice([-2, -1, 0, 1, 2])))
        add_khlui(buf_l, buf_r, st, dur, CENTRAL_SCALE[note_idx], vol=0.38, pan=0.4)
        
        # Khim shimmering arpeggios
        st_k = int((b + 0.4) * beat_dur * SR)
        add_khim(buf_l, buf_r, st_k, beat_dur * 0.9, CENTRAL_SCALE[(note_idx + 2) % len(CENTRAL_SCALE)], vol=0.32, pan=0.65)
        
        # Ching on pulse
        if b % 2 == 0:
            add_ching(buf_l, buf_r, st, is_ching=True, vol=0.2)
        else:
            add_ching(buf_l, buf_r, st, is_ching=False, vol=0.2)

def gen_central_02(buf_l, buf_r, bpm, length_sec):
    # Rattanakosin Grace (Ranat & Palace strings)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(302)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.3
        note_idx = max(0, min(len(CENTRAL_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_ranat(buf_l, buf_r, st, dur, CENTRAL_SCALE[note_idx], vol=0.38, pan=0.5)
        if b % 2 == 0:
            add_khim(buf_l, buf_r, st, beat_dur * 1.8, CENTRAL_SCALE[max(0, note_idx - 2)], vol=0.26, pan=0.65)

def gen_central_03(buf_l, buf_r, bpm, length_sec):
    # Temple Fair Ramwong (Upbeat festive temple fair / งานวัดย้อนยุค)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(303)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.65
        
        # Fast Ranat Ek flourishes
        note_idx = max(0, min(len(CENTRAL_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_ranat(buf_l, buf_r, st, dur, CENTRAL_SCALE[note_idx], vol=0.42, pan=0.45)
        
        # Double Ranat stroke
        st_sub = int((b + 0.5) * beat_dur * SR)
        add_ranat(buf_l, buf_r, st_sub, dur * 0.8, CENTRAL_SCALE[(note_idx + 1) % len(CENTRAL_SCALE)], vol=0.35, pan=0.55)
        
        # Ramwong "Pom-Pom-Chung" rhythm
        add_drum_bass(buf_l, buf_r, st, vol=0.45, freq=85)
        st_slap = int((b + 0.5) * beat_dur * SR)
        add_drum_slap(buf_l, buf_r, st_slap, vol=0.4)
        add_ching(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.26)

# --- 4. EAST (Coastal & Orchards) ---
# Scale: D4, F#4, G4, A4, C#5, D5
EAST_SCALE = [293.66, 369.99, 392.00, 440.00, 554.37, 587.33]

def gen_east_01(buf_l, buf_r, bpm, length_sec):
    # Eastern Breeze (Ranat Khim ocean waves)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(401)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.4
        note_idx = max(0, min(len(EAST_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1, 2])))
        add_khim(buf_l, buf_r, st, dur, EAST_SCALE[note_idx], vol=0.36, pan=0.6)
        if b % 2 == 0:
            add_ranat(buf_l, buf_r, st, beat_dur * 1.8, EAST_SCALE[(note_idx + 1) % len(EAST_SCALE)], vol=0.32, pan=0.4)
            
    # Sea wave swell in background
    for i in range(len(buf_l)):
        t = i / SR
        swell = 0.5 + 0.5 * math.sin(2 * math.pi * 0.1 * t)
        noise = (random.random() * 2 - 1) * 0.04 * swell
        buf_l[i] += noise
        buf_r[i] += noise * 0.8

def gen_east_02(buf_l, buf_r, bpm, length_sec):
    # Chanthaburi Orchard Melody (Gentle fruit garden atmosphere)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(402)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.3
        note_idx = max(0, min(len(EAST_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_khlui(buf_l, buf_r, st, dur, EAST_SCALE[note_idx], vol=0.36, pan=0.42)
        st_k = int((b + 0.5) * beat_dur * SR)
        add_khim(buf_l, buf_r, st_k, beat_dur * 0.8, EAST_SCALE[(note_idx + 2) % len(EAST_SCALE)], vol=0.28, pan=0.65)

def gen_east_03(buf_l, buf_r, bpm, length_sec):
    # Eastern Coastal Fiesta (Upbeat fishermen's tropical carnival)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(403)
    note_idx = 1
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.7
        
        # Bouncing Ranat melody
        note_idx = max(0, min(len(EAST_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_ranat(buf_l, buf_r, st, dur, EAST_SCALE[note_idx], vol=0.42, pan=0.4)
        
        # Khim upbeat syncopation
        st_k = int((b + 0.5) * beat_dur * SR)
        add_khim(buf_l, buf_r, st_k, beat_dur * 0.5, EAST_SCALE[(note_idx + 3) % len(EAST_SCALE)], vol=0.35, pan=0.65)
        
        # Coastal hand drums
        add_drum_bass(buf_l, buf_r, st, vol=0.44, freq=90)
        add_drum_slap(buf_l, buf_r, st_k, vol=0.38)
        add_bamboo_clapper(buf_l, buf_r, st, vol=0.22)
        add_ching(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.22)

# --- 5. WEST (Mon Hills & Kanchanaburi) ---
# Scale: G3, Bb3, C4, D4, F4, G4, Bb4
WEST_SCALE = [196.0, 233.08, 261.63, 293.66, 349.23, 392.0, 466.16]

def gen_west_01(buf_l, buf_r, bpm, length_sec):
    # Western Mon Hills (Khlui Mon bamboo flute)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(501)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.6
        note_idx = max(0, min(len(WEST_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1, 2])))
        add_khlui(buf_l, buf_r, st, dur, WEST_SCALE[note_idx], vol=0.4, pan=0.45)
        if b % 2 == 1:
            add_bamboo_clapper(buf_l, buf_r, st, vol=0.2)

def gen_west_02(buf_l, buf_r, bpm, length_sec):
    # Kwai River Cascades (Bamboo whisper & flowing stream)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(502)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.5
        note_idx = max(0, min(len(WEST_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_khlui(buf_l, buf_r, st, dur, WEST_SCALE[note_idx], vol=0.36, pan=0.4)
        st_sub = int((b + 0.5) * beat_dur * SR)
        add_bamboo_clapper(buf_l, buf_r, st_sub, vol=0.18)

def gen_west_03(buf_l, buf_r, bpm, length_sec):
    # Mon Folk Carnival (Upbeat bamboo clapper dance / กรับไผ่คะนอง)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(503)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.7
        
        # Fast rhythmic Khlui trills
        note_idx = max(0, min(len(WEST_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_khlui(buf_l, buf_r, st, dur, WEST_SCALE[note_idx], vol=0.42, pan=0.42)
        
        # Double bamboo clapper syncopation
        for sub in [0.25, 0.75]:
            sub_st = int((b + sub) * beat_dur * SR)
            add_bamboo_clapper(buf_l, buf_r, sub_st, vol=0.3)
            
        # Two-faced drum rhythm
        add_drum_bass(buf_l, buf_r, st, vol=0.46, freq=70)
        st_slap = int((b + 0.5) * beat_dur * SR)
        add_drum_slap(buf_l, buf_r, st_slap, vol=0.38)
        add_ching(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.24)

# --- 6. SOUTH (Pak Tai & Andaman) ---
# Scale: D4, Eb4, F#4, G4, A4, Bb4, D5
SOUTH_SCALE = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 587.33]

def gen_south_01(buf_l, buf_r, bpm, length_sec):
    # Southern Tide (Pi Tai & Thap drum rhythm)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(601)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.0
        note_idx = max(0, min(len(SOUTH_SCALE) - 1, note_idx + rnd.choice([-2, -1, 0, 1, 2])))
        add_pi_tai(buf_l, buf_r, st, dur, SOUTH_SCALE[note_idx], vol=0.4, pan=0.48)
        
        # Thap drum
        if b % 2 == 0:
            add_drum_bass(buf_l, buf_r, st, vol=0.45, freq=80)
            add_ching(buf_l, buf_r, st, is_ching=True, vol=0.24)
        else:
            add_drum_slap(buf_l, buf_r, st, vol=0.38)
            add_ching(buf_l, buf_r, st, is_ching=False, vol=0.2)

def gen_south_02(buf_l, buf_r, bpm, length_sec):
    # Similan Calm Waters (Sea breeze & gentle reed)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(602)
    note_idx = 2
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 1.5
        note_idx = max(0, min(len(SOUTH_SCALE) - 1, note_idx + rnd.choice([-1, 0, 1])))
        add_pi_tai(buf_l, buf_r, st, dur, SOUTH_SCALE[note_idx], vol=0.32, pan=0.45)
        if b % 2 == 1:
            add_drum_slap(buf_l, buf_r, st, vol=0.2)

def gen_south_03(buf_l, buf_r, bpm, length_sec):
    # Nora Energetic Dance (Upbeat Manohra festival / โนราห์แดนซ์)
    beat_dur = 60.0 / bpm
    beats = int(length_sec / beat_dur)
    rnd = random.Random(603)
    note_idx = 3
    for b in range(beats):
        st = int(b * beat_dur * SR)
        dur = beat_dur * 0.65
        
        # Wild, impassioned Pi Tai reed ornaments
        note_idx = max(0, min(len(SOUTH_SCALE) - 1, note_idx + rnd.choice([-2, -1, 1, 2])))
        add_pi_tai(buf_l, buf_r, st, dur, SOUTH_SCALE[note_idx], vol=0.44, pan=0.5)
        
        # Fast Thap goblet drum groove ("Ting-Cha-Therng-Ting")
        add_drum_bass(buf_l, buf_r, st, vol=0.52, freq=88)
        st_16th = int((b + 0.33) * beat_dur * SR)
        add_drum_slap(buf_l, buf_r, st_16th, vol=0.44)
        st_8th = int((b + 0.66) * beat_dur * SR)
        add_drum_slap(buf_l, buf_r, st_8th, vol=0.4)
        
        # Clashing brass cymbals
        add_ching(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.3)

# ==============================================================================
# MAIN SUITE GENERATOR
# ==============================================================================

TRACKS_CONFIG = [
    # 1. North
    ("north_01", 84, 52.0, gen_north_01, "Lanna Chiang Mai · Salo & Sueng Mist"),
    ("north_02", 74, 50.0, gen_north_02, "Lanna Chiang Mai · Wiang Ping Hills"),
    ("north_03", 128, 48.0, gen_north_03, "Lanna Chiang Mai · Poy Luang Carnival (สนุกๆ)"),
    
    # 2. Northeast
    ("northeast_01", 92, 50.0, gen_northeast_01, "Isan Heartland · Khaen & Phin Lam Phern"),
    ("northeast_02", 76, 52.0, gen_northeast_02, "Isan Heartland · Mekong Sunset Serenade"),
    ("northeast_03", 134, 48.0, gen_northeast_03, "Isan Heartland · Rocket Festival Toey Samcha (สนุกๆ)"),
    
    # 3. Central
    ("central_01", 80, 52.0, gen_central_01, "Chao Phraya Serenade · Khim & Khlui Breeze"),
    ("central_02", 72, 50.0, gen_central_02, "Rattanakosin Grace · Palace Strings & Ranat"),
    ("central_03", 124, 48.0, gen_central_03, "Temple Fair Ramwong · Festive Drums & Cymbals (สนุกๆ)"),
    
    # 4. East
    ("east_01", 78, 52.0, gen_east_01, "Eastern Breeze · Ranat Khim Waves"),
    ("east_02", 84, 50.0, gen_east_02, "Chanthaburi Orchard Melody"),
    ("east_03", 128, 48.0, gen_east_03, "Eastern Coastal Fiesta · Fishermen's Joy (สนุกๆ)"),
    
    # 5. West
    ("west_01", 82, 52.0, gen_west_01, "Western Mon Hills · Khlui Cadence"),
    ("west_02", 75, 50.0, gen_west_02, "Kwai River Cascades · Bamboo Whisper"),
    ("west_03", 130, 48.0, gen_west_03, "Mon Folk Carnival · Bamboo Clapper Dance (สนุกๆ)"),
    
    # 6. South
    ("south_01", 108, 50.0, gen_south_01, "Southern Tide · Pi Tai & Thap Rhythm"),
    ("south_02", 78, 52.0, gen_south_02, "Similan Calm Waters · Sea Breeze Flute"),
    ("south_03", 138, 48.0, gen_south_03, "Nora Energetic Dance · Southern Carnival (สนุกๆ)"),
]

def main():
    print(f"=== Generating 18 Authentic Thai Regional Music Tracks ({len(TRACKS_CONFIG)} tracks) ===")
    for name, bpm, length, gen_fn, title in TRACKS_CONFIG:
        print(f"Synthesizing [{name}] {title} ({bpm} BPM)...")
        l, r = compose_track(bpm, length, gen_fn)
        save_music_track(name, l, r, bpm)
    print("=== Complete! All 18 tracks & SoundCraft projects created successfully ===")

if __name__ == '__main__':
    main()
