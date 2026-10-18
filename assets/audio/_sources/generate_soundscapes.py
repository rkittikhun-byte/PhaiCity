"""
Phaicity Thai Soundscapes & Audio Assets Generator (Pure Python + SoundCraft)
=============================================================================
Procedural synthesis and SoundCraft project generator for authentic Thai sound effects & ambient music.
Outputs:
1. High-fidelity 16-bit/44.1kHz master WAV audio files in assets/audio/_sources/projects/
2. Compressed game-ready Vorbis .ogg files in assets/audio/sfx/ and assets/audio/music/ (via tools/ffmpeg.exe)
3. Native SoundCraft DAW project files (.scraft) in assets/audio/_sources/projects/ for editing in SoundCraft.

License: CC0 1.0 Universal (Public Domain)
Author: PhaiCity Audio Craftsman (Generated for PhaiCity Project)
"""

import os
import math
import json
import wave
import struct
import random
import subprocess

SR = 44100
ROOT = os.path.abspath(".")
OUT_SFX = os.path.join(ROOT, "assets", "audio", "sfx")
OUT_MUSIC = os.path.join(ROOT, "assets", "audio", "music")
OUT_PROJECTS = os.path.join(ROOT, "assets", "audio", "_sources", "projects")
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")

os.makedirs(OUT_SFX, exist_ok=True)
os.makedirs(OUT_MUSIC, exist_ok=True)
os.makedirs(OUT_PROJECTS, exist_ok=True)

def write_wav(path, samples_left, samples_right=None):
    is_stereo = samples_right is not None
    num_channels = 2 if is_stereo else 1
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(num_channels)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        
        # Normalize
        max_val = 1e-6
        for s in samples_left:
            if abs(s) > max_val: max_val = abs(s)
        if is_stereo:
            for s in samples_right:
                if abs(s) > max_val: max_val = abs(s)
                
        scale = 30000.0 / max_val
        frames = bytearray()
        
        if is_stereo:
            for l, r in zip(samples_left, samples_right):
                sl = int(max(-32767, min(32767, l * scale)))
                sr = int(max(-32767, min(32767, r * scale)))
                frames.extend(struct.pack('<hh', sl, sr))
        else:
            for l in samples_left:
                sl = int(max(-32767, min(32767, l * scale)))
                frames.extend(struct.pack('<h', sl))
                
        wav.writeframes(frames)

def save_sound(name, samples_left, samples_right=None, is_music=False):
    target_dir = OUT_MUSIC if is_music else OUT_SFX
    ogg_path = os.path.join(target_dir, f"{name}.ogg")
    wav_path = os.path.join(OUT_PROJECTS, f"{name}.wav")
    
    # Write master WAV
    write_wav(wav_path, samples_left, samples_right)
    
    # Convert to Vorbis OGG with ffmpeg
    cmd = [FFMPEG, "-y", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "5", ogg_path]
    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"Error converting {name} to ogg")
    else:
        print(f"[Generated] {name} -> {ogg_path}")
        
    duration = len(samples_left) / SR
    create_soundcraft_project(name, wav_path, duration, samples_right is not None)

def create_soundcraft_project(name, wav_path, duration, is_stereo):
    rel_wav = os.path.basename(wav_path)
    project = {
        "format_version": 1,
        "name": name,
        "sample_rate": SR,
        "bit_depth": "Int16",
        "frame_rate": "Fps30",
        "timecode_start": 0,
        "tempo": {
            "tempos": [{"tick": 0, "bpm": 120.0}],
            "meters": [{"tick": 0, "numerator": 4, "denominator": 4}]
        },
        "tracks": [
            {
                "id": "track_1",
                "name": name.replace("-", " ").title(),
                "channel_format": "Stereo" if is_stereo else "Mono",
                "volume_db": 0.0,
                "pan": 0.0,
                "clips": [
                    {
                        "id": "clip_1",
                        "name": rel_wav,
                        "file": rel_wav,
                        "start_tick": 0,
                        "length_ticks": int(duration * 960 * 2)
                    }
                ]
            }
        ]
    }
    proj_path = os.path.join(OUT_PROJECTS, f"{name}.scraft")
    with open(proj_path, "w", encoding="utf-8") as f:
        json.dump(project, f, indent=2)

# ==============================================================================
# 1. THAI VEHICLES & LIFE
# ==============================================================================

def generate_tuktuk():
    duration = 4.0
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SR
        rpm = 800 + 1000 * math.exp(-((t - 1.5) ** 2) / 0.4) + 400 * (1 if t > 2.0 else 0)
        freq = rpm / 60.0
        phase += 2 * math.pi * freq / SR
        pulse = math.sin(phase) + 0.4 * math.sin(2 * phase) + 0.2 * math.sin(3 * phase)
        pop = math.copysign(abs(math.sin(phase)) ** 7, math.sin(phase))
        noise = (random.random() * 2 - 1) * 0.1 if math.sin(phase) > 0.8 else 0.0
        samples[i] = pop * 0.7 + pulse * 0.2 + noise
    return samples

def generate_longtail_boat():
    duration = 5.5
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SR
        chug_freq = 24.0 + 2.0 * math.sin(2 * math.pi * 0.3 * t)
        phase += 2 * math.pi * chug_freq / SR
        thud = math.sin(phase) + 0.5 * math.sin(2 * phase)
        thud = math.copysign(abs(thud) ** 3, thud)
        water_slap = (random.random() * 2 - 1) * 0.35 if math.sin(phase * 3.0) > 0.2 else 0.0
        env = 1.0
        if t < 0.5: env = t / 0.5
        elif t > 4.5: env = (5.5 - t) / 1.0
        samples[i] = (thud * 0.6 + water_slap) * env
    return samples

def generate_motorcycle():
    duration = 3.2
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SR
        freq = 170.0 - 60.0 / (1.0 + math.exp(-(t - 1.6) * 4))
        phase += 2 * math.pi * freq / SR
        engine = math.sin(phase) + 0.35 * math.sin(2 * phase)
        dist = math.sqrt(1.0 + (t - 1.6) ** 2 * 14.0)
        amp = 1.0 / dist
        samples[i] = engine * amp
    return samples

# ==============================================================================
# 2. THAI CEREMONY & MILESTONES
# ==============================================================================

def generate_temple_bell():
    duration = 5.0
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    partials = [
        (220.0, 1.0, 4.0),
        (264.0, 0.75, 3.5),
        (330.0, 0.6, 2.8),
        (440.0, 0.7, 2.5),
        (560.0, 0.35, 1.8),
        (780.0, 0.25, 1.2),
        (1150.0, 0.15, 0.8),
    ]
    for i in range(num_samples):
        t = i / SR
        val = 0.0
        for freq, amp, decay in partials:
            beat = math.cos(2 * math.pi * 1.5 * t)
            env = math.exp(-t / decay)
            val += amp * math.sin(2 * math.pi * freq * t) * (1.0 + 0.15 * beat) * env
        strike = math.exp(-t / 0.02) * (random.random() * 2 - 1) * 0.3
        samples[i] = val + strike
    return samples

def generate_gong():
    duration = 5.5
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    f0 = 146.83
    for i in range(num_samples):
        t = i / SR
        body = (
            1.0 * math.sin(2 * math.pi * f0 * t) * math.exp(-t / 3.8) +
            0.65 * math.sin(2 * math.pi * (f0 * 1.48) * t) * math.exp(-t / 3.0) +
            0.45 * math.sin(2 * math.pi * (f0 * 2.1) * t) * math.exp(-t / 2.2) +
            0.25 * math.sin(2 * math.pi * (f0 * 3.2) * t) * math.exp(-t / 1.5)
        )
        mod = 1.0 + 0.25 * math.sin(2 * math.pi * 3.8 * t) * math.exp(-t / 4.0)
        attack = math.exp(-t / 0.04) * 0.4
        samples[i] = body * mod + attack
    return samples

# ==============================================================================
# 3. THAI TOOLS & UI ELEMENTS
# ==============================================================================

def generate_bamboo_click():
    duration = 0.2
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SR
        body = (
            0.8 * math.sin(2 * math.pi * 860.0 * t) * math.exp(-t / 0.025) +
            0.5 * math.sin(2 * math.pi * 1920.0 * t) * math.exp(-t / 0.015) +
            0.25 * math.sin(2 * math.pi * 2400.0 * t) * math.exp(-t / 0.008)
        )
        click = (random.random() * 2 - 1) * 0.4 * math.exp(-t / 0.004)
        samples[i] = body + click
    return samples

def generate_baht_coins():
    duration = 0.65
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    frequencies = [3400.0, 4250.0, 5800.0, 7150.0, 8900.0]
    delays = [0.0, 0.045, 0.095, 0.16]
    for i in range(num_samples):
        t = i / SR
        val = 0.0
        for d in delays:
            if t >= d:
                dt = t - d
                env = math.exp(-dt / 0.06)
                for f in frequencies:
                    val += 0.2 * math.sin(2 * math.pi * f * dt) * env
        samples[i] = val
    return samples

def generate_pile_driver():
    duration = 1.3
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SR
        freq = 55.0 * math.exp(-t * 8)
        thud = math.sin(2 * math.pi * freq * t) * math.exp(-t / 0.35)
        slam = (random.random() * 2 - 1) * 0.7 * math.exp(-t / 0.03)
        metal = math.sin(2 * math.pi * 1850 * t) * math.exp(-t / 0.12) * 0.25
        samples[i] = thud * 0.7 + slam + metal
    return samples

def generate_tractor():
    duration = 1.1
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SR
        engine = math.sin(2 * math.pi * 65.0 * t) * 0.35
        gravel = (random.random() * 2 - 1) * 0.45
        env = (math.sin(math.pi * t / duration)) ** 1.5
        samples[i] = (engine + gravel) * env
    return samples

# ==============================================================================
# 4. THAI NATURE & AMBIENCE
# ==============================================================================

def generate_night_cicadas():
    duration = 12.0
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SR
        carrier1 = math.sin(2 * math.pi * 4250 * t)
        pulse1 = ((0.5 + 0.5 * math.sin(2 * math.pi * 2.8 * t)) ** 3)
        cicada = carrier1 * pulse1 * 0.35
        
        carrier2 = math.sin(2 * math.pi * 6600 * t)
        chirp = 1.0 if math.sin(2 * math.pi * 14 * t) > 0.4 else 0.0
        cricket = carrier2 * chirp * 0.18
        
        breeze = (random.random() * 2 - 1) * 0.04
        samples[i] = cicada + cricket + breeze
    return samples

def generate_rooster():
    duration = 2.6
    num_samples = int(SR * duration)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SR
        if t < 0.35:
            freq = 420.0
            amp = math.sin(math.pi * t / 0.35)
        elif t < 0.7:
            freq = 530.0
            amp = math.sin(math.pi * (t - 0.35) / 0.35)
        elif t < 1.7:
            freq = 690.0 - 40 * (t - 0.7)
            amp = 1.0 - 0.2 * (t - 0.7)
        else:
            freq = 560.0 - 150 * (t - 1.7)
            amp = 0.8 * math.exp(-(t - 1.7) / 0.4)
            
        phase += 2 * math.pi * freq / SR
        voice = math.sin(phase) + 0.6 * math.sin(2 * phase) + 0.35 * math.sin(3 * phase)
        samples[i] = voice * amp
    return samples

# ==============================================================================
# 5. REGIONAL MUSIC (EAST, WEST, SOUTH)
# ==============================================================================

def generate_music_track(region, scale, bpm, length_sec=50.0):
    num_samples = int(SR * length_sec)
    left = [0.0] * num_samples
    right = [0.0] * num_samples
    beat_dur = 60.0 / bpm
    num_beats = int(length_sec / beat_dur)
    
    rnd = random.Random(42 if region == 'south' else (108 if region == 'east' else 216))
    current_idx = 0
    
    for b in range(num_beats):
        start_idx = int(b * beat_dur * SR)
        dur = beat_dur * (0.8 if region == 'south' else 1.5)
        n_note = int(dur * SR)
        if start_idx + n_note >= num_samples: break
        
        step = rnd.choice([-2, -1, 0, 1, 2])
        current_idx = max(0, min(len(scale) - 1, current_idx + step))
        freq = scale[current_idx]
        
        pan = 0.5 + 0.25 * math.sin(b * 0.8)
        phase = 0.0
        for ni in range(n_note):
            nt = ni / SR
            if region == 'south':
                # Pi Tai (Reed)
                vib = 1.0 + 0.015 * math.sin(2 * math.pi * 5.5 * nt)
                phase += 2 * math.pi * freq * vib / SR
                wave_val = math.sin(phase) + 0.5 * math.sin(2 * phase) + 0.25 * math.sin(3 * phase)
                env = (math.sin(math.pi * nt / dur)) ** 0.5
            elif region == 'east':
                # Ranat/Khim
                phase += 2 * math.pi * freq / SR
                wave_val = math.sin(phase) + 0.3 * math.sin(2 * phase)
                env = math.exp(-nt / (dur * 0.6))
            elif region == 'north':
                # Salo (Fiddle) & Sueng (Lute): rich bowed saw-string tone with sweet gentle vibrato
                vib = 1.0 + 0.012 * math.sin(2 * math.pi * 5.0 * nt)
                phase += 2 * math.pi * freq * vib / SR
                # Bowed string partials + plucked sueng harmonic
                wave_val = (math.sin(phase) + 
                            0.55 * math.sin(2 * phase) + 
                            0.35 * math.sin(3 * phase) + 
                            0.20 * math.sin(4 * phase))
                # Gentle attack and singing sustain
                env = math.sin(math.pi * nt / dur) ** 0.8
            else:
                # West Khlui
                phase += 2 * math.pi * freq / SR
                breath = (rnd.random() * 2 - 1) * 0.04
                wave_val = math.sin(phase) + 0.2 * math.sin(2 * phase) + breath
                env = math.sin(math.pi * nt / dur)
                
            sample = wave_val * env * 0.5
            left[start_idx + ni] += sample * (1.0 - pan)
            right[start_idx + ni] += sample * pan
            
    # Add percussion/bed
    if region == 'south':
        drum_len = int(0.2 * SR)
        for b in range(num_beats):
            idx = int(b * beat_dur * SR)
            if idx + drum_len >= num_samples: break
            for di in range(drum_len):
                dt = di / SR
                if b % 2 == 0:
                    drum = math.sin(2 * math.pi * 75 * math.exp(-dt * 20) * dt) * math.exp(-dt / 0.08) * 0.4
                    left[idx + di] += drum
                    right[idx + di] += drum
                else:
                    snap = (rnd.random() * 2 - 1) * math.exp(-dt / 0.04) * 0.25
                    left[idx + di] += snap
                    right[idx + di] += snap
    elif region == 'east':
        for i in range(num_samples):
            t = i / SR
            wave_env = 0.5 + 0.5 * math.sin(2 * math.pi * 0.12 * t)
            noise = (rnd.random() * 2 - 1) * 0.05
            left[i] += noise * wave_env
            right[i] += noise * (1.0 - wave_env)
    elif region == 'north':
        # Sueng plucked background arpeggios + warm mountain mist reverb
        sueng_scale = [s * 2.0 for s in scale] # higher octave plucked accompaniment
        for b in range(num_beats * 2): # eighth notes
            sub_start = int(b * (beat_dur / 2.0) * SR)
            sub_dur = beat_dur * 0.9
            sub_samples = int(sub_dur * SR)
            if sub_start + sub_samples >= num_samples: break
            sfreq = rnd.choice(sueng_scale)
            for si in range(sub_samples):
                st = si / SR
                # Plucked acoustic string
                pluck = (math.sin(2 * math.pi * sfreq * st) + 0.4 * math.sin(4 * math.pi * sfreq * st)) * math.exp(-st / 0.25)
                left[sub_start + si] += pluck * 0.15
                right[sub_start + si] += pluck * 0.18

    return left, right

def main():
    print("=== Generating Authentic Thai Audio Assets & Sources ===")
    
    # 1. Thai Vehicles
    save_sound("tuktuk", generate_tuktuk())
    save_sound("longtail-boat", generate_longtail_boat())
    save_sound("motorcycle", generate_motorcycle())
    
    # 2. Ceremony & Milestones
    save_sound("temple-bell", generate_temple_bell())
    save_sound("gong", generate_gong())
    
    # 3. Thai UI & Tools
    save_sound("ui-click", generate_bamboo_click())
    save_sound("ui-coin", generate_baht_coins())
    save_sound("tool-pile-driver", generate_pile_driver())
    save_sound("tool-tractor", generate_tractor())
    
    # 4. Thai Nature
    save_sound("amb-night-cicadas", generate_night_cicadas())
    save_sound("rooster", generate_rooster())
    
    # 5. Regional Music Tracks (North, South, East, West)
    north_scale = [220.0, 246.94, 277.18, 329.63, 369.99, 440.0]        # Lanna D-F#-A pentatonic mode
    south_scale = [220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88]
    east_scale  = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]
    west_scale  = [196.00, 220.00, 261.63, 293.66, 329.63, 392.00]
    
    l, r = generate_music_track('north', north_scale, 84, 55.0)
    save_sound("north_01", l, r, is_music=True)

    l, r = generate_music_track('north', north_scale, 78, 52.0)
    save_sound("north_02", l, r, is_music=True)

    l, r = generate_music_track('south', south_scale, 118, 50.0)
    save_sound("south_01", l, r, is_music=True)
    
    l, r = generate_music_track('east', east_scale, 76, 55.0)
    save_sound("east_01", l, r, is_music=True)
    
    l, r = generate_music_track('west', west_scale, 82, 55.0)
    save_sound("west_01", l, r, is_music=True)

    print("All audio files and SoundCraft projects generated successfully!")

if __name__ == '__main__':
    main()
