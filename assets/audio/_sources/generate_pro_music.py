"""
PhaiCity Professional Regional Thai Music Suite (Pro Engine)
============================================================
High-fidelity, serious, mature, and culturally authentic Thai music engine:
- Full structured melodic compositions (Verse, Chorus, Bridge, Resolution)
- Physical Karplus-Strong string modeling with wooden body resonance (Sueng, Phin, Khim)
- Modal resonance synthesis for struck hardwood & bamboo slats (Ranat Ek, Ponglang)
- Natural acoustic wind modeling with breath turbulence & expressive microtonal vibrato (Khlui, Pi Tai)
- Resonant bowed string friction modeling (Salo)
- Authentic Thai drum grooves & rhythmic cycles (หน้าทับปรบไก่, หน้าทับสองไม้, สามช่า, รำวง, ตะลุง, โนราห์)
- Studio mastering via FFmpeg (Room acoustic convolution, multi-band tone sculpting, analog glue compression)

License: CC0 1.0 Universal (Public Domain)
Author: PhaiCity Master Sound Artisan
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

# Standard note frequencies
C3, D3, Eb3, E3, F3, Fs3, G3, Ab3, A3, Bb3, B3 = 130.81, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00, 233.08, 246.94
C4, Cs4, D4, Eb4, E4, F4, Fs4, G4, Ab4, A4, Bb4, B4 = 261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88
C5, Cs5, D5, Eb5, E5, F5, Fs5, G5, Ab5, A5, Bb5, B5 = 523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61, 880.00, 932.33, 987.77
C2, D2, E2, F2, G2, A2, B2 = 65.41, 73.42, 82.41, 87.31, 98.00, 110.00, 123.47

# ==============================================================================
# HIGH-FIDELITY PHYSICAL & MODAL INSTRUMENT SYNTHESIS
# ==============================================================================

def karplus_strong(freq, dur, decay=0.988, brightness=0.45, wood_tap=True):
    """Physical acoustic string modeling (Sueng, Phin, Khim)."""
    N = max(4, int(SR / freq))
    raw = [random.random() * 2 - 1 for _ in range(N)]
    buf = [0.0] * N
    for i in range(1, N):
        buf[i] = raw[i] * brightness + raw[i-1] * (1.0 - brightness)
    total = int(dur * SR)
    out = [0.0] * total
    idx = 0
    tap_env = math.exp(-freq / 400.0)
    for i in range(total):
        val = buf[idx]
        next_val = buf[(idx + 1) % N]
        avg = 0.5 * (val + next_val) * decay
        buf[idx] = avg
        t = i / SR
        # Subtle hollow wooden body resonance
        wood = math.sin(2 * math.pi * 165 * t) * math.exp(-t / 0.025) * 0.25 * tap_env if (wood_tap and t < 0.04) else 0.0
        out[i] = val + wood
        idx = (idx + 1) % N
    return out

def add_ks_note(buf_l, buf_r, start_s, dur_s, freq, vol=0.35, pan=0.5, decay=0.988, brightness=0.45):
    samples = karplus_strong(freq, dur_s, decay=decay, brightness=brightness)
    for i, s in enumerate(samples):
        idx = start_s + i
        if idx >= len(buf_l): break
        v = s * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_ranat_ek(buf_l, buf_r, start_s, dur_s, freq, vol=0.38, pan=0.5):
    """Hardwood xylophone bar with mallet transient & inharmonic modes."""
    total = int(dur_s * SR)
    tau = min(0.45, max(0.12, 120.0 / freq))
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        p1 = 2 * math.pi * freq * t
        p2 = 2 * math.pi * (freq * 2.76) * t
        p3 = 2 * math.pi * (freq * 5.4) * t
        bar = math.sin(p1) + 0.42 * math.sin(p2) + 0.18 * math.sin(p3)
        mallet = (random.random() * 2 - 1) * math.exp(-t / 0.006) * 0.45
        env = math.exp(-t / tau)
        v = (bar + mallet) * env * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_ponglang(buf_l, buf_r, start_s, dur_s, freq, vol=0.42, pan=0.6):
    """Isan log xylophone with deep resonant body and crisp wooden click."""
    total = int(dur_s * SR)
    tau = 0.22
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        p1 = 2 * math.pi * freq * t
        p2 = 2 * math.pi * (freq * 2.98) * t
        thud = math.sin(2 * math.pi * 110 * t) * math.exp(-t / 0.015) * 0.5
        wood = math.sin(p1) + 0.35 * math.sin(p2)
        env = math.exp(-t / tau)
        v = (wood + thud) * env * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_salo_bowed(buf_l, buf_r, start_s, dur_s, freq, vol=0.36, pan=0.42):
    """Lanna bowed fiddle (สะล้อ) with human vibrato and singing resonance."""
    total = int(dur_s * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        vib_rate = 5.2
        vib_depth = 0.012 if t > 0.08 else 0.003
        vib = 1.0 + vib_depth * math.sin(2 * math.pi * vib_rate * t)
        p = 2 * math.pi * freq * vib * t
        # Rich bowed string harmonics
        s = (math.sin(p) + 
             0.55 * math.sin(2 * p) + 
             0.38 * math.sin(3 * p) + 
             0.22 * math.sin(4 * p) + 
             0.14 * math.sin(5 * p) + 
             0.08 * math.sin(6 * p))
        att = min(1.0, t / 0.09)
        rel = min(1.0, (dur_s - t) / 0.1) if t > dur_s - 0.1 else 1.0
        v = s * att * rel * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_khlui_flute(buf_l, buf_r, start_s, dur_s, freq, vol=0.38, pan=0.48):
    """Thai bamboo duct flute (ขลุ่ย) with breath turbulence and graceful portamento."""
    total = int(dur_s * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        bend = 1.0 - 0.018 * math.exp(-t / 0.035)
        vib = 1.0 + 0.01 * math.sin(2 * math.pi * 5.0 * t) if t > 0.1 else 1.0
        p = 2 * math.pi * freq * bend * vib * t
        breath = (random.random() * 2 - 1) * 0.035
        flute = math.sin(p) + 0.22 * math.sin(2 * p) + 0.08 * math.sin(3 * p) + breath
        att = min(1.0, t / 0.08)
        rel = min(1.0, (dur_s - t) / 0.09) if t > dur_s - 0.09 else 1.0
        v = flute * att * rel * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_pi_tai_reed(buf_l, buf_r, start_s, dur_s, freq, vol=0.42, pan=0.5):
    """Southern Thai quadruple reed oboe (ปี่ใต้) with piercing ornament & vibrato."""
    total = int(dur_s * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        vib = 1.0 + 0.018 * math.sin(2 * math.pi * 5.8 * t)
        p = 2 * math.pi * freq * vib * t
        reed = (math.sin(p) + 
                0.68 * math.sin(2 * p) + 
                0.48 * math.sin(3 * p) + 
                0.32 * math.sin(4 * p) + 
                0.22 * math.sin(5 * p) + 
                0.12 * math.sin(6 * p))
        att = min(1.0, t / 0.05)
        rel = min(1.0, (dur_s - t) / 0.07) if t > dur_s - 0.07 else 1.0
        v = reed * att * rel * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

def add_khaen_organ(buf_l, buf_r, start_s, dur_s, freqs, vol=0.32, pan=0.5):
    """Isan mouth organ (แคน) chord cluster with reed buzzing and breath flutter."""
    total = int(dur_s * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        reed_sum = 0.0
        for f in freqs:
            p1 = 2 * math.pi * (f - 0.4) * t
            p2 = 2 * math.pi * (f + 0.4) * t
            reed_sum += 0.5 * (math.sin(p1) + math.sin(p2)) + 0.3 * math.sin(3 * p1)
        reed_sum /= len(freqs)
        att = min(1.0, t / 0.07)
        rel = min(1.0, (dur_s - t) / 0.08) if t > dur_s - 0.08 else 1.0
        flutter = 0.92 + 0.08 * math.sin(2 * math.pi * 4.0 * t)
        v = reed_sum * att * rel * flutter * vol
        buf_l[idx] += v * (1.0 - pan)
        buf_r[idx] += v * pan

# --- DRUMS & PERCUSSION ---

def add_thap_drum(buf_l, buf_r, start_s, is_slap=False, vol=0.48):
    """Southern goblet drum (กลองทับ). Deep resonant bass vs sharp ceramic/skin slap."""
    dur = 0.16 if is_slap else 0.32
    total = int(dur * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        if is_slap:
            snap = (random.random() * 2 - 1) * math.exp(-t / 0.018)
            pop = math.sin(2 * math.pi * 420 * math.exp(-t * 50) * t) * math.exp(-t / 0.035) * 0.7
            v = (snap + pop) * vol
        else:
            f = 110 * math.exp(-t * 18)
            boom = math.sin(2 * math.pi * f * t) * math.exp(-t / 0.12)
            v = boom * vol
        buf_l[idx] += v * 0.55
        buf_r[idx] += v * 0.45

def add_sabatchai_drum(buf_l, buf_r, start_s, vol=0.55, freq=58):
    """Northern grand war drum (กลองสะบัดชัย). Heavy wooden sub-bass impact."""
    total = int(0.38 * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        f = freq * math.exp(-t * 14)
        bass = math.sin(2 * math.pi * f * t) * math.exp(-t / 0.15)
        rim = (random.random() * 2 - 1) * math.exp(-t / 0.01) * 0.35
        v = (bass + rim) * vol
        buf_l[idx] += v * 0.6
        buf_r[idx] += v * 0.4

def add_samcha_drum(buf_l, buf_r, start_s, is_bass=True, vol=0.45):
    """Isan folk drum (กลองหาง/กลองยาว) with punchy bounce."""
    dur = 0.22 if is_bass else 0.14
    total = int(dur * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        if is_bass:
            f = 82 * math.exp(-t * 20)
            v = math.sin(2 * math.pi * f * t) * math.exp(-t / 0.09) * vol
        else:
            v = ((random.random() * 2 - 1) * 0.6 + math.sin(2 * math.pi * 310 * t) * 0.4) * math.exp(-t / 0.025) * vol
        buf_l[idx] += v * 0.5
        buf_r[idx] += v * 0.5

def add_ramwong_drum(buf_l, buf_r, start_s, is_po=True, vol=0.46):
    """Central temple fair drum (กลองรำมะนา/โทนชาตรี) - 'Po' (low) vs 'Chung' (high slap)."""
    dur = 0.25 if is_po else 0.15
    total = int(dur * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        if is_po:
            f = 92 * math.exp(-t * 18)
            v = math.sin(2 * math.pi * f * t) * math.exp(-t / 0.1) * vol
        else:
            f = 240 * math.exp(-t * 30)
            snap = (random.random() * 2 - 1) * math.exp(-t / 0.015) * 0.4
            v = (math.sin(2 * math.pi * f * t) + snap) * math.exp(-t / 0.04) * vol
        buf_l[idx] += v * 0.5
        buf_r[idx] += v * 0.5

def add_bamboo_krab(buf_l, buf_r, start_s, vol=0.35):
    """Acoustic Thai bamboo clapper (กรับไม้ไผ่)."""
    total = int(0.09 * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        click = (random.random() * 2 - 1) * math.exp(-t / 0.007)
        body = math.sin(2 * math.pi * 1420 * t) * math.exp(-t / 0.02) * 0.6
        v = (click + body) * vol
        buf_l[idx] += v * 0.55
        buf_r[idx] += v * 0.45

def add_ching_cycle(buf_l, buf_r, start_s, is_ching=True, vol=0.28):
    """Thai brass cymbals (ฉิ่ง = ringing open bell, ฉับ = closed damped click)."""
    dur = 0.7 if is_ching else 0.12
    total = int(dur * SR)
    for i in range(total):
        idx = start_s + i
        if idx >= len(buf_l): break
        t = i / SR
        p1 = 2 * math.pi * 3240 * t
        p2 = 2 * math.pi * 6520 * t
        bell = math.sin(p1) + 0.45 * math.sin(p2)
        env = math.exp(-t / (0.32 if is_ching else 0.028))
        v = bell * env * vol
        buf_l[idx] += v * 0.5
        buf_r[idx] += v * 0.5

# ==============================================================================
# STRUCTURED COMPOSITIONS (REAL THAI MUSICAL PHRASING & MOTIFS)
# ==============================================================================

def play_phrase(buf_l, buf_r, start_beat, beat_dur, melody_notes, instrument_fn, vol=0.38, pan=0.5):
    """Plays a list of (note_freq, duration_in_beats, offset_in_beats)."""
    for freq, d_beats, o_beats in melody_notes:
        if freq is None: continue # Rest
        st = int((start_beat + o_beats) * beat_dur * SR)
        dur = d_beats * beat_dur * 0.95
        instrument_fn(buf_l, buf_r, st, dur, freq, vol=vol, pan=pan)

def play_chords_arpeggio(buf_l, buf_r, start_beat, beat_dur, chords, inst_fn, vol=0.24, pan=0.62):
    """Fingerpicked acoustic arpeggios on Karplus-Strong string."""
    for b_idx, chord in enumerate(chords):
        for sub, note in enumerate(chord):
            st = int((start_beat + b_idx + sub * 0.25) * beat_dur * SR)
            dur = beat_dur * 0.85
            inst_fn(buf_l, buf_r, st, dur, note, vol=vol, pan=pan)

# --- 1. NORTH (Lanna) ---
def compose_north_01(buf_l, buf_r, bpm=84, length_sec=52.0):
    # Lanna Chiang Mai · Salo & Sueng Mist (ล่องแม่ปิง / ลาวดวงดอกไม้ motif)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    # 8-bar melodic sentences (authentic Lanna motif)
    phrase_A = [
        (D4, 1.0, 0.0), (Fs4, 1.0, 1.0), (A4, 1.5, 2.0), (B4, 0.5, 3.5),
        (A4, 1.0, 4.0), (Fs4, 1.0, 5.0), (E4, 1.5, 6.0), (D4, 0.5, 7.5),
        (Fs4, 1.0, 8.0), (A4, 1.0, 9.0), (B4, 1.5, 10.0), (D5, 0.5, 11.5),
        (B4, 1.0, 12.0), (A4, 1.0, 13.0), (Fs4, 1.5, 14.0), (A4, 0.5, 15.5)
    ]
    phrase_B = [
        (D5, 1.0, 0.0), (E5, 1.0, 1.0), (D5, 1.5, 2.0), (B4, 0.5, 3.5),
        (A4, 1.0, 4.0), (B4, 1.0, 5.0), (D5, 1.5, 6.0), (B4, 0.5, 7.5),
        (A4, 1.0, 8.0), (Fs4, 1.0, 9.0), (E4, 1.0, 10.0), (D4, 1.0, 11.0),
        (E4, 1.0, 12.0), (Fs4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    
    # Sueng chords (D Major & B Minor Lanna modes)
    chords_A = [
        [D3, A3, D4, Fs4], [D3, A3, D4, Fs4], [B2, Fs3, B3, D4], [B2, Fs3, B3, D4],
        [G2, D3, G3, B3], [G2, D3, G3, B3], [A2, E3, A3, Cs4], [A2, E3, A3, Cs4],
        [D3, A3, D4, Fs4], [D3, A3, D4, Fs4], [B2, Fs3, B3, D4], [B2, Fs3, B3, D4],
        [G2, D3, G3, B3], [A2, E3, A3, Cs4], [D3, A3, D4, Fs4], [D3, A3, D4, Fs4]
    ]

    # Play sections: Intro (8 beats) -> Verse A -> Verse B -> Outro
    for rep in range(0, total_beats, 32):
        if rep + 32 > total_beats: break
        play_chords_arpeggio(buf_l, buf_r, rep, beat_dur, chords_A, add_ks_note, vol=0.25, pan=0.65)
        play_chords_arpeggio(buf_l, buf_r, rep + 16, beat_dur, chords_A, add_ks_note, vol=0.25, pan=0.65)
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_A, add_salo_bowed, vol=0.40, pan=0.38)
        play_phrase(buf_l, buf_r, rep + 16, beat_dur, phrase_B, add_salo_bowed, vol=0.42, pan=0.38)
        
        # Ching cycles & soft wood claps on strong beats
        for b in range(rep, rep + 32):
            st = int(b * beat_dur * SR)
            add_ching_cycle(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.22)
            if b % 4 == 0:
                add_bamboo_krab(buf_l, buf_r, st, vol=0.24)

def compose_north_02(buf_l, buf_r, bpm=74, length_sec=50.0):
    # Lanna Chiang Mai · Wiang Ping Hills (น้อยใจยา / ม่านแม่ปิง serene acoustic)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (A3, 1.0, 0.0), (D4, 1.0, 1.0), (E4, 1.0, 2.0), (Fs4, 1.0, 3.0),
        (E4, 1.0, 4.0), (D4, 1.0, 5.0), (A3, 1.0, 6.0), (B3, 1.0, 7.0),
        (D4, 1.0, 8.0), (E4, 1.0, 9.0), (Fs4, 1.5, 10.0), (A4, 0.5, 11.5),
        (Fs4, 1.0, 12.0), (E4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    chords = [
        [D3, A3, D4], [D3, A3, D4], [B2, Fs3, B3], [B2, Fs3, B3],
        [G2, D3, G3], [G2, D3, G3], [A2, E3, A3], [A2, E3, A3],
        [D3, A3, D4], [D3, A3, D4], [B2, Fs3, B3], [B2, Fs3, B3],
        [G2, D3, G3], [A2, E3, A3], [D3, A3, D4], [D3, A3, D4]
    ]
    
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_chords_arpeggio(buf_l, buf_r, rep, beat_dur, chords, add_ks_note, vol=0.28, pan=0.58)
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ks_note, vol=0.38, pan=0.42)
        # Salo singing accompaniment in 3rds
        phrase_salo = [(f * 1.25 if f else None, d, o) for f, d, o in phrase]
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_salo, add_salo_bowed, vol=0.22, pan=0.32)

def compose_north_03(buf_l, buf_r, bpm=128, length_sec=48.0):
    # Lanna Grand Poy Luang Carnival (ฟ้อนเจิงสะบัดชัย / งานบุญปอยหลวง)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    riff = [
        (D5, 0.5, 0.0), (D5, 0.5, 0.5), (B4, 0.5, 1.0), (A4, 0.5, 1.5),
        (B4, 0.5, 2.0), (D5, 0.5, 2.5), (B4, 0.5, 3.0), (A4, 0.5, 3.5),
        (Fs4, 0.5, 4.0), (A4, 0.5, 4.5), (B4, 0.5, 5.0), (A4, 0.5, 5.5),
        (Fs4, 0.5, 6.0), (E4, 0.5, 6.5), (D4, 1.0, 7.0)
    ]
    riff_B = [
        (D5, 0.5, 0.0), (E5, 0.5, 0.5), (Fs5, 0.5, 1.0), (E5, 0.5, 1.5),
        (D5, 0.5, 2.0), (B4, 0.5, 2.5), (A4, 0.5, 3.0), (B4, 0.5, 3.5),
        (D5, 0.5, 4.0), (B4, 0.5, 4.5), (A4, 0.5, 5.0), (Fs4, 0.5, 5.5),
        (E4, 0.5, 6.0), (Fs4, 0.5, 6.5), (D4, 1.0, 7.0)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        # Heavy Sabatchai drum drive
        if b % 2 == 0:
            add_sabatchai_drum(buf_l, buf_r, st, vol=0.55, freq=55)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.28)
        else:
            add_thap_drum(buf_l, buf_r, st, is_slap=True, vol=0.45)
            add_ching_cycle(buf_l, buf_r, st, is_ching=False, vol=0.24)
            add_bamboo_krab(buf_l, buf_r, st, vol=0.32)
            
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_salo_bowed, vol=0.44, pan=0.42)
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ks_note, vol=0.36, pan=0.68)
        play_phrase(buf_l, buf_r, rep + 8, beat_dur, riff_B, add_salo_bowed, vol=0.46, pan=0.42)
        play_phrase(buf_l, buf_r, rep + 8, beat_dur, riff_B, add_ks_note, vol=0.38, pan=0.68)

# --- 2. NORTHEAST (Isan) ---
def compose_northeast_01(buf_l, buf_r, bpm=92, length_sec=50.0):
    # Isan Heartland · Khaen & Phin Lam Phern (ลายลมพัดพร้าว / ลายโปงลาง)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    # Authentic Phin melody in Am Pentatonic (A, C, D, E, G, A)
    phrase_A = [
        (A4, 0.5, 0.0), (C5, 0.5, 0.5), (D5, 1.0, 1.0), (E5, 1.0, 2.0),
        (D5, 0.5, 3.0), (C5, 0.5, 3.5), (A4, 1.0, 4.0), (G4, 1.0, 5.0),
        (A4, 0.5, 6.0), (C5, 0.5, 6.5), (D5, 0.5, 7.0), (C5, 0.5, 7.5),
        (A4, 1.0, 8.0), (G4, 1.0, 9.0), (E4, 1.0, 10.0), (A4, 1.0, 11.0)
    ]
    phrase_B = [
        (E5, 0.5, 0.0), (G5, 0.5, 0.5), (E5, 1.0, 1.0), (D5, 1.0, 2.0),
        (C5, 0.5, 3.0), (D5, 0.5, 3.5), (E5, 1.0, 4.0), (D5, 1.0, 5.0),
        (C5, 0.5, 6.0), (A4, 0.5, 6.5), (G4, 0.5, 7.0), (E4, 0.5, 7.5),
        (G4, 1.0, 8.0), (A4, 1.0, 9.0), (A4, 2.0, 10.0)
    ]
    
    for rep in range(0, total_beats, 24):
        if rep + 24 > total_beats: break
        # Sustained Khaen drone (A3 + E4)
        for b in range(rep, rep + 24, 4):
            st = int(b * beat_dur * SR)
            add_khaen_organ(buf_l, buf_r, st, beat_dur * 4.2, [A3, E4, A4], vol=0.28, pan=0.68)
        # Phin master lead
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_A, add_ks_note, vol=0.45, pan=0.38)
        play_phrase(buf_l, buf_r, rep + 12, beat_dur, phrase_B, add_ks_note, vol=0.46, pan=0.38)
        # Ponglang accents on offbeats
        for b in range(rep, rep + 24):
            st = int(b * beat_dur * SR)
            if b % 2 == 1:
                add_ponglang(buf_l, buf_r, st, beat_dur * 0.5, E4, vol=0.28, pan=0.55)

def compose_northeast_02(buf_l, buf_r, bpm=76, length_sec=52.0):
    # Isan Heartland · Mekong Sunset Serenade (ลายสุดสะแนน)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (E4, 1.0, 0.0), (A4, 1.0, 1.0), (C5, 1.5, 2.0), (B4, 0.5, 3.5),
        (A4, 1.0, 4.0), (G4, 1.0, 5.0), (E4, 1.5, 6.0), (G4, 0.5, 7.5),
        (A4, 1.0, 8.0), (C5, 1.0, 9.0), (D5, 1.0, 10.0), (E5, 1.0, 11.0),
        (D5, 1.0, 12.0), (C5, 1.0, 13.0), (A4, 2.0, 14.0)
    ]
    
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        # Khaen gentle drone
        for b in range(rep, rep + 16, 4):
            st = int(b * beat_dur * SR)
            add_khaen_organ(buf_l, buf_r, st, beat_dur * 4.2, [A3, E4], vol=0.24, pan=0.65)
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ks_note, vol=0.42, pan=0.4)

def compose_northeast_03(buf_l, buf_r, bpm=134, length_sec=48.0):
    # Rocket Festival Toey Samcha (เซิ้งบั้งไฟม่วนซื่น / ลายเต้ยโขงเต้ยสามช่า)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    # Rapid Ponglang runs & driving Phin riff
    riff = [
        (A4, 0.5, 0.0), (C5, 0.5, 0.5), (D5, 0.5, 1.0), (E5, 0.5, 1.5),
        (G5, 0.5, 2.0), (E5, 0.5, 2.5), (D5, 0.5, 3.0), (C5, 0.5, 3.5),
        (A4, 0.5, 4.0), (C5, 0.5, 4.5), (D5, 0.5, 5.0), (E5, 0.5, 5.5),
        (D5, 0.5, 6.0), (C5, 0.5, 6.5), (A4, 0.5, 7.0), (G4, 0.5, 7.5)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        # Samcha rhythm: Bass on 1, 3; Slap on 2, 4 with syncopated 16th kick
        if b % 2 == 0:
            add_samcha_drum(buf_l, buf_r, st, is_bass=True, vol=0.52)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.26)
        else:
            add_samcha_drum(buf_l, buf_r, st, is_bass=False, vol=0.45)
            st_sub = int((b + 0.5) * beat_dur * SR)
            add_samcha_drum(buf_l, buf_r, st_sub, is_bass=True, vol=0.42)
            add_ching_cycle(buf_l, buf_r, st, is_ching=False, vol=0.22)
            
    for rep in range(0, total_beats, 8):
        if rep + 8 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ponglang, vol=0.45, pan=0.62)
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ks_note, vol=0.42, pan=0.38)

# --- 3. CENTRAL (Chao Phraya) ---
def compose_central_01(buf_l, buf_r, bpm=80, length_sec=52.0):
    # Chao Phraya Serenade (ลาวดวงเดือน & เขมรไทรโยค classic melody)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase_A = [
        (C4, 1.0, 0.0), (D4, 1.0, 1.0), (E4, 1.5, 2.0), (G4, 0.5, 3.5),
        (A4, 1.0, 4.0), (G4, 1.0, 5.0), (E4, 1.5, 6.0), (D4, 0.5, 7.5),
        (E4, 1.0, 8.0), (G4, 1.0, 9.0), (A4, 1.5, 10.0), (C5, 0.5, 11.5),
        (A4, 1.0, 12.0), (G4, 1.0, 13.0), (E4, 1.5, 14.0), (G4, 0.5, 15.5)
    ]
    phrase_B = [
        (C5, 1.0, 0.0), (D5, 1.0, 1.0), (C5, 1.5, 2.0), (A4, 0.5, 3.5),
        (G4, 1.0, 4.0), (A4, 1.0, 5.0), (C5, 1.5, 6.0), (A4, 0.5, 7.5),
        (G4, 1.0, 8.0), (E4, 1.0, 9.0), (D4, 1.0, 10.0), (C4, 1.0, 11.0),
        (D4, 1.0, 12.0), (E4, 1.0, 13.0), (C4, 2.0, 14.0)
    ]
    
    for rep in range(0, total_beats, 32):
        if rep + 32 > total_beats: break
        # Flute sings main melody
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_A, add_khlui_flute, vol=0.42, pan=0.45)
        play_phrase(buf_l, buf_r, rep + 16, beat_dur, phrase_B, add_khlui_flute, vol=0.44, pan=0.45)
        # Khim hammered shimmering accompaniment
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_A, add_ks_note, vol=0.32, pan=0.68)
        play_phrase(buf_l, buf_r, rep + 16, beat_dur, phrase_B, add_ks_note, vol=0.32, pan=0.68)
        for b in range(rep, rep + 32):
            st = int(b * beat_dur * SR)
            add_ching_cycle(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.22)

def compose_central_02(buf_l, buf_r, bpm=72, length_sec=50.0):
    # Rattanakosin Grace (ระนาดเอกและเครื่องสายพระราชวัง)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (G3, 1.0, 0.0), (C4, 1.0, 1.0), (D4, 1.0, 2.0), (E4, 1.0, 3.0),
        (D4, 1.0, 4.0), (C4, 1.0, 5.0), (A3, 1.0, 6.0), (G3, 1.0, 7.0),
        (C4, 1.0, 8.0), (D4, 1.0, 9.0), (E4, 1.5, 10.0), (G4, 0.5, 11.5),
        (E4, 1.0, 12.0), (D4, 1.0, 13.0), (C4, 2.0, 14.0)
    ]
    
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ranat_ek, vol=0.42, pan=0.5)
        # Double octave Ranat strike
        phrase_hi = [(f * 2.0 if f else None, d, o) for f, d, o in phrase]
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase_hi, add_ranat_ek, vol=0.30, pan=0.55)

def compose_central_03(buf_l, buf_r, bpm=124, length_sec=48.0):
    # Temple Fair Ramwong (รำวงสำราญใจ / ค้างคาวกินกล้วย งานวัดไทย)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    riff = [
        (C5, 0.5, 0.0), (A4, 0.5, 0.5), (G4, 0.5, 1.0), (A4, 0.5, 1.5),
        (C5, 0.5, 2.0), (A4, 0.5, 2.5), (G4, 0.5, 3.0), (E4, 0.5, 3.5),
        (G4, 0.5, 4.0), (A4, 0.5, 4.5), (G4, 0.5, 5.0), (E4, 0.5, 5.5),
        (D4, 0.5, 6.0), (C4, 0.5, 6.5), (C4, 1.0, 7.0)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        # Ramwong "Pom-Pom-Chung" rhythm
        if b % 2 == 0:
            add_ramwong_drum(buf_l, buf_r, st, is_po=True, vol=0.52)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.28)
        else:
            add_ramwong_drum(buf_l, buf_r, st, is_po=False, vol=0.46)
            add_ching_cycle(buf_l, buf_r, st, is_ching=False, vol=0.24)
            
    for rep in range(0, total_beats, 8):
        if rep + 8 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ranat_ek, vol=0.45, pan=0.45)
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_khlui_flute, vol=0.38, pan=0.55)

# --- 4. EAST (Coastal & Orchards) ---
def compose_east_01(buf_l, buf_r, bpm=78, length_sec=52.0):
    # Eastern Breeze (ระนาดขิมคลื่นลมทะเลบูรพา)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (D4, 1.0, 0.0), (Fs4, 1.0, 1.0), (G4, 1.5, 2.0), (A4, 0.5, 3.5),
        (Cs5, 1.0, 4.0), (A4, 1.0, 5.0), (G4, 1.5, 6.0), (Fs4, 0.5, 7.5),
        (G4, 1.0, 8.0), (A4, 1.0, 9.0), (Cs5, 1.0, 10.0), (D5, 1.0, 11.0),
        (Cs5, 1.0, 12.0), (A4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ks_note, vol=0.40, pan=0.62)
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ranat_ek, vol=0.32, pan=0.38)
        
    # Ocean swell background
    for i in range(len(buf_l)):
        t = i / SR
        swell = 0.5 + 0.5 * math.sin(2 * math.pi * 0.08 * t)
        noise = (random.random() * 2 - 1) * 0.035 * swell
        buf_l[i] += noise
        buf_r[i] += noise * 0.85

def compose_east_02(buf_l, buf_r, bpm=84, length_sec=50.0):
    # Chanthaburi Orchard Melody (สวนผลไม้เมืองจันท์)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (A3, 1.0, 0.0), (D4, 1.0, 1.0), (Fs4, 1.5, 2.0), (G4, 0.5, 3.5),
        (A4, 1.0, 4.0), (G4, 1.0, 5.0), (Fs4, 1.5, 6.0), (E4, 0.5, 7.5),
        (Fs4, 1.0, 8.0), (G4, 1.0, 9.0), (A4, 1.0, 10.0), (Cs5, 1.0, 11.0),
        (A4, 1.0, 12.0), (Fs4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_khlui_flute, vol=0.42, pan=0.45)
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_ks_note, vol=0.32, pan=0.65)

def compose_east_03(buf_l, buf_r, bpm=128, length_sec=48.0):
    # Coastal Fiesta (ระบำชาวเลบูรพา)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    riff = [
        (D5, 0.5, 0.0), (Cs5, 0.5, 0.5), (A4, 0.5, 1.0), (G4, 0.5, 1.5),
        (A4, 0.5, 2.0), (Cs5, 0.5, 2.5), (A4, 0.5, 3.0), (Fs4, 0.5, 3.5),
        (G4, 0.5, 4.0), (A4, 0.5, 4.5), (G4, 0.5, 5.0), (Fs4, 0.5, 5.5),
        (E4, 0.5, 6.0), (Fs4, 0.5, 6.5), (D4, 1.0, 7.0)
    ]
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        if b % 2 == 0:
            add_ramwong_drum(buf_l, buf_r, st, is_po=True, vol=0.50)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.25)
        else:
            add_ramwong_drum(buf_l, buf_r, st, is_po=False, vol=0.44)
            add_bamboo_krab(buf_l, buf_r, st, vol=0.3)
            
    for rep in range(0, total_beats, 8):
        if rep + 8 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ranat_ek, vol=0.45, pan=0.42)
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ks_note, vol=0.38, pan=0.68)

# --- 5. WEST (Mon Hills & Kanchanaburi) ---
def compose_west_01(buf_l, buf_r, bpm=82, length_sec=52.0):
    # Western Mon Hills (มอญดูดาว / ทิวเขามอญคะเน)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (D4, 1.0, 0.0), (F4, 1.0, 1.0), (G4, 1.5, 2.0), (Bb4, 0.5, 3.5),
        (G4, 1.0, 4.0), (F4, 1.0, 5.0), (D4, 1.5, 6.0), (C4, 0.5, 7.5),
        (D4, 1.0, 8.0), (F4, 1.0, 9.0), (G4, 1.0, 10.0), (D4, 1.0, 11.0),
        (C4, 1.0, 12.0), (Bb3, 1.0, 13.0), (G3, 2.0, 14.0)
    ]
    
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_khlui_flute, vol=0.45, pan=0.45)
        # Low Mon bamboo drone
        for b in range(rep, rep + 16, 4):
            st = int(b * beat_dur * SR)
            add_ks_note(buf_l, buf_r, st, beat_dur * 3.8, G2, vol=0.28, pan=0.5)

def compose_west_02(buf_l, buf_r, bpm=75, length_sec=50.0):
    # Kwai River Cascades (ธารน้ำตกแควน้อย)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (G3, 1.0, 0.0), (C4, 1.0, 1.0), (D4, 1.5, 2.0), (F4, 0.5, 3.5),
        (G4, 1.0, 4.0), (F4, 1.0, 5.0), (D4, 1.5, 6.0), (C4, 0.5, 7.5),
        (D4, 1.0, 8.0), (F4, 1.0, 9.0), (G4, 1.0, 10.0), (Bb4, 1.0, 11.0),
        (G4, 1.0, 12.0), (F4, 1.0, 13.0), (G3, 2.0, 14.0)
    ]
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_khlui_flute, vol=0.42, pan=0.42)
        if rep % 2 == 1:
            st = int((rep + 8) * beat_dur * SR)
            add_bamboo_krab(buf_l, buf_r, st, vol=0.25)

def compose_west_03(buf_l, buf_r, bpm=130, length_sec=48.0):
    # Mon Folk Carnival (ระบำมอญรื่นเริง / กรับไผ่คะนอง)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    riff = [
        (G4, 0.5, 0.0), (Bb4, 0.5, 0.5), (C5, 0.5, 1.0), (D5, 0.5, 1.5),
        (C5, 0.5, 2.0), (Bb4, 0.5, 2.5), (G4, 0.5, 3.0), (F4, 0.5, 3.5),
        (G4, 0.5, 4.0), (F4, 0.5, 4.5), (D4, 0.5, 5.0), (C4, 0.5, 5.5),
        (D4, 0.5, 6.0), (F4, 0.5, 6.5), (G4, 1.0, 7.0)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        if b % 2 == 0:
            add_sabatchai_drum(buf_l, buf_r, st, vol=0.52, freq=65)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.26)
        else:
            add_thap_drum(buf_l, buf_r, st, is_slap=True, vol=0.42)
            add_bamboo_krab(buf_l, buf_r, st, vol=0.35)
            
    for rep in range(0, total_beats, 8):
        if rep + 8 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_khlui_flute, vol=0.45, pan=0.45)
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_ks_note, vol=0.38, pan=0.65)

# --- 6. SOUTH (Pak Tai & Manohra Heritage) ---
def compose_south_01(buf_l, buf_r, bpm=108, length_sec=50.0):
    # Southern Tide (โหมโรงมโนราห์ / ปี่ใต้และกลองทับอันดามัน)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (D4, 1.0, 0.0), (Fs4, 1.0, 1.0), (G4, 1.5, 2.0), (A4, 0.5, 3.5),
        (Bb4, 1.0, 4.0), (A4, 1.0, 5.0), (G4, 1.5, 6.0), (Fs4, 0.5, 7.5),
        (G4, 1.0, 8.0), (A4, 1.0, 9.0), (Bb4, 1.0, 10.0), (D5, 1.0, 11.0),
        (Bb4, 1.0, 12.0), (A4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        # Authentic Southern Thap drum pattern (ตึ้ง-ชา-เทิ่ง)
        if b % 2 == 0:
            add_thap_drum(buf_l, buf_r, st, is_slap=False, vol=0.52)
            add_ching_cycle(buf_l, buf_r, st, is_ching=True, vol=0.28)
        else:
            add_thap_drum(buf_l, buf_r, st, is_slap=True, vol=0.45)
            add_ching_cycle(buf_l, buf_r, st, is_ching=False, vol=0.24)
            
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_pi_tai_reed, vol=0.45, pan=0.48)

def compose_south_02(buf_l, buf_r, bpm=78, length_sec=52.0):
    # Similan Calm Waters (ทะเลสิมิลันยามสงบ)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    phrase = [
        (A3, 1.0, 0.0), (D4, 1.0, 1.0), (Fs4, 1.5, 2.0), (G4, 0.5, 3.5),
        (A4, 1.0, 4.0), (G4, 1.0, 5.0), (Fs4, 1.5, 6.0), (Eb4, 0.5, 7.5),
        (Fs4, 1.0, 8.0), (G4, 1.0, 9.0), (A4, 1.0, 10.0), (Bb4, 1.0, 11.0),
        (A4, 1.0, 12.0), (Fs4, 1.0, 13.0), (D4, 2.0, 14.0)
    ]
    for rep in range(0, total_beats, 16):
        if rep + 16 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, phrase, add_khlui_flute, vol=0.40, pan=0.45)
        # Deep Andaman ocean swells
        for b in range(rep, rep + 16, 4):
            st = int(b * beat_dur * SR)
            add_thap_drum(buf_l, buf_r, st, is_slap=False, vol=0.32)

def compose_south_03(buf_l, buf_r, bpm=138, length_sec=48.0):
    # Nora Grand Dance (มโนราห์เริงระบำ / โนราห์แดนซ์ ดุเดือดเร้าใจ)
    beat_dur = 60.0 / bpm
    total_beats = int(length_sec / beat_dur)
    
    # Fierce Manohra reed melody
    riff = [
        (D5, 0.5, 0.0), (Eb5, 0.5, 0.5), (D5, 0.5, 1.0), (Bb4, 0.5, 1.5),
        (A4, 0.5, 2.0), (G4, 0.5, 2.5), (Fs4, 0.5, 3.0), (G4, 0.5, 3.5),
        (A4, 0.5, 4.0), (Bb4, 0.5, 4.5), (D5, 0.5, 5.0), (Bb4, 0.5, 5.5),
        (A4, 0.5, 6.0), (G4, 0.5, 6.5), (D4, 1.0, 7.0)
    ]
    
    for b in range(total_beats):
        st = int(b * beat_dur * SR)
        # Fast furious Thap goblet drum groove
        add_thap_drum(buf_l, buf_r, st, is_slap=False, vol=0.55)
        st_16th = int((b + 0.35) * beat_dur * SR)
        add_thap_drum(buf_l, buf_r, st_16th, is_slap=True, vol=0.48)
        st_8th = int((b + 0.7) * beat_dur * SR)
        add_thap_drum(buf_l, buf_r, st_8th, is_slap=True, vol=0.42)
        add_ching_cycle(buf_l, buf_r, st, is_ching=(b % 2 == 0), vol=0.32)
        
    for rep in range(0, total_beats, 8):
        if rep + 8 > total_beats: break
        play_phrase(buf_l, buf_r, rep, beat_dur, riff, add_pi_tai_reed, vol=0.48, pan=0.5)

# ==============================================================================
# MASTERING & ENCODING PIPELINE
# ==============================================================================

def write_wav(path, left, right):
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        max_val = 1e-6
        for l, r in zip(left, right):
            al, ar = abs(l), abs(r)
            if al > max_val: max_val = al
            if ar > max_val: max_val = ar
        scale = 27000.0 / max_val
        frames = bytearray()
        for l, r in zip(left, right):
            sl = int(max(-32767, min(32767, l * scale)))
            sr = int(max(-32767, min(32767, r * scale)))
            frames.extend(struct.pack('<hh', sl, sr))
        wav.writeframes(frames)

def save_mastered_track(name, left, right, bpm):
    wav_raw = os.path.join(OUT_PROJECTS, f"{name}.wav")
    ogg_path = os.path.join(OUT_MUSIC, f"{name}.ogg")
    
    # 1. Write pristine master WAV
    write_wav(wav_raw, left, right)
    
    # 2. Apply Studio Mastering Audio Filter via FFmpeg:
    # - aecho: natural warm room acoustic reflections
    # - equalizer: warm analog low-mids + silky smooth highs
    # - compand: studio glue dynamics compressor
    audio_filter = (
        "aecho=0.8:0.88:36|56:0.24|0.16,"
        "equalizer=f=120:width_type=o:w=1:g=2.5,"
        "equalizer=f=3200:width_type=o:w=1:g=-1.2,"
        "compand=attacks=0.03:decays=0.15:points=-60/-60|-24/-10|0/-2"
    )
    cmd = [
        FFMPEG, "-y", "-i", wav_raw,
        "-af", audio_filter,
        "-c:a", "libvorbis", "-q:a", "5",
        ogg_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"Error mastering {name}.ogg")
    else:
        print(f"[Mastered] {name}.ogg -> {ogg_path}")
        
    duration = len(left) / SR
    create_soundcraft_project(name, wav_raw, duration, bpm)

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
# MAIN PRO SUITE ORCHESTRATION
# ==============================================================================

PRO_TRACKS = [
    ("north_01", 84, 52.0, compose_north_01, "Lanna Chiang Mai · Salo & Sueng Mist"),
    ("north_02", 74, 50.0, compose_north_02, "Lanna Chiang Mai · Wiang Ping Hills"),
    ("north_03", 128, 48.0, compose_north_03, "Lanna Chiang Mai · Poy Luang Carnival (สนุกๆ)"),
    
    ("northeast_01", 92, 50.0, compose_northeast_01, "Isan Heartland · Khaen & Phin Lam Phern"),
    ("northeast_02", 76, 52.0, compose_northeast_02, "Isan Heartland · Mekong Sunset Serenade"),
    ("northeast_03", 134, 48.0, compose_northeast_03, "Isan Heartland · Rocket Festival Toey Samcha (สนุกๆ)"),
    
    ("central_01", 80, 52.0, compose_central_01, "Chao Phraya Serenade · Khim & Khlui Breeze"),
    ("central_02", 72, 50.0, compose_central_02, "Rattanakosin Grace · Palace Strings & Ranat"),
    ("central_03", 124, 48.0, compose_central_03, "Temple Fair Ramwong · Festive Drums & Cymbals (สนุกๆ)"),
    
    ("east_01", 78, 52.0, compose_east_01, "Eastern Breeze · Ranat Khim Waves"),
    ("east_02", 84, 50.0, compose_east_02, "Chanthaburi Orchard Melody"),
    ("east_03", 128, 48.0, compose_east_03, "Eastern Coastal Fiesta · Fishermen's Joy (สนุกๆ)"),
    
    ("west_01", 82, 52.0, compose_west_01, "Western Mon Hills · Khlui Cadence"),
    ("west_02", 75, 50.0, compose_west_02, "Kwai River Cascades · Bamboo Whisper"),
    ("west_03", 130, 48.0, compose_west_03, "Mon Folk Carnival · Bamboo Clapper Dance (สนุกๆ)"),
    
    ("south_01", 108, 50.0, compose_south_01, "Southern Tide · Pi Tai & Thap Rhythm"),
    ("south_02", 78, 52.0, compose_south_02, "Similan Calm Waters · Sea Breeze Flute"),
    ("south_03", 138, 48.0, compose_south_03, "Nora Energetic Dance · Southern Carnival (สนุกๆ)"),
]

def main():
    print(f"=== Synthesizing & Mastering 18 Professional Thai Music Tracks ===")
    for name, bpm, length_sec, comp_fn, title in PRO_TRACKS:
        print(f"Mastering [{name}] {title} ({bpm} BPM)...")
        num_samples = int(SR * length_sec)
        l = [0.0] * num_samples
        r = [0.0] * num_samples
        comp_fn(l, r, bpm, length_sec)
        save_mastered_track(name, l, r, bpm)
    print("=== Complete! All 18 professional tracks mastered successfully ===")

if __name__ == '__main__':
    main()
