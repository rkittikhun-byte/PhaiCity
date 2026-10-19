# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Activity clips (อิริยาบถ, PLAN.md "Activities"): keyframes of the shared parts, so one clip fits every character.

A key is (frame, pose) where pose uses the same words as a character's pose (scripts/characters/*.py):
  body / head: pitch (forward +), roll (to the character's left +), turn (to its left +)
  arm_R / arm_L: pitch (forward +), spread (out from the body +), twist (forearm towards the body +), elbow (bend +)
  leg_R / leg_L: pitch (forward +), turn (toes out +), knee (bend +)
  root_z: lift of the whole person in metres (sitting is negative)
A part missing from a key keeps its rest pose (arms spread 6, everything else 0). Frames run at 24 a second; a
looping clip's last key equals its first.
"""

FPS = 24

REST = {'arm_R': {'spread': 6}, 'arm_L': {'spread': 6}}


def mirror(pose):
    """The same pose with right and left swapped."""
    out = {}
    for k, v in pose.items():
        if k.endswith('_R'):
            out[k[:-2] + '_L'] = v
        elif k.endswith('_L'):
            out[k[:-2] + '_R'] = v
        else:
            out[k] = v
    return out


def _walk(stride, knee, arm, elbow, lean=0.0, bob=0.02, frames=24):
    h = frames // 2
    q = frames // 4
    a = {'body': {'pitch': lean}, 'root_z': 0.0,
         'leg_R': {'pitch': stride, 'knee': 5}, 'leg_L': {'pitch': -stride, 'knee': knee * 0.5},
         'arm_R': {'pitch': -arm, 'elbow': elbow, 'spread': 6}, 'arm_L': {'pitch': arm, 'elbow': elbow, 'spread': 6}}
    mid = {'body': {'pitch': lean}, 'root_z': bob,
           'leg_R': {'pitch': 0, 'knee': 10}, 'leg_L': {'pitch': 0, 'knee': knee},
           'arm_R': {'pitch': 0, 'elbow': elbow, 'spread': 6}, 'arm_L': {'pitch': 0, 'elbow': elbow, 'spread': 6}}
    return [(0, a), (q, mid), (h, mirror(a)), (h + q, mirror(mid)), (frames, a)]


SIT_STOOL = {'root_z': -0.17, 'leg_R': {'pitch': 88, 'knee': 88}, 'leg_L': {'pitch': 88, 'knee': 88}}
SIT_FLOOR = {'root_z': -0.47, 'leg_R': {'pitch': 88, 'turn': 40, 'knee': 150},
             'leg_L': {'pitch': 88, 'turn': 40, 'knee': 150}}

CLIPS = {
    'idle': dict(th='ยืน', loop=True, keys=[
        (0, {'body': {'pitch': 0}, 'head': {'turn': 0}}),
        (24, {'body': {'pitch': 1.5}, 'head': {'turn': 6, 'pitch': 2}}),
        (48, {'body': {'pitch': 0}, 'head': {'turn': 0}})]),
    'walk': dict(th='เดิน', loop=True, note='about 0.85 m a cycle: move the root 0.85 m/s', keys=_walk(24, 35, 22, 15)),
    'walk_carry': dict(th='เดินถือของ', loop=True, arms=False, note='legs only: the hands keep the character pose',
                       keys=[(f, {k: v for k, v in p.items() if not k.startswith('arm')}) for f, p in
                             _walk(20, 30, 0, 0)]),
    'run': dict(th='วิ่ง / วิ่งออกกำลัง', loop=True, note='about 1.9 m a cycle at 16 frames: 2.8 m/s',
                keys=_walk(42, 85, 45, 85, lean=10, bob=0.05, frames=16)),
    'bike': dict(th='ปั่นจักรยาน', loop=True, prop={'type': 'bicycle', 'hand': 'none', 'at': (0, 0.06, 0),
                                                    'scale': 0.72},
                 note='the bicycle prop is drawn at 0.72 scale under the rider (bicycle in props)', keys=[
        (0, {'root_z': 0.07, 'body': {'pitch': 25}, 'arm_R': {'pitch': 62, 'elbow': 15, 'spread': 4},
             'arm_L': {'pitch': 62, 'elbow': 15, 'spread': 4},
             'leg_R': {'pitch': 75, 'knee': 95}, 'leg_L': {'pitch': 30, 'knee': 35}}),
        (6, {'root_z': 0.07, 'body': {'pitch': 25}, 'arm_R': {'pitch': 62, 'elbow': 15, 'spread': 4},
             'arm_L': {'pitch': 62, 'elbow': 15, 'spread': 4},
             'leg_R': {'pitch': 55, 'knee': 50}, 'leg_L': {'pitch': 55, 'knee': 90}}),
        (12, {'root_z': 0.07, 'body': {'pitch': 25}, 'arm_R': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'arm_L': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'leg_R': {'pitch': 30, 'knee': 35}, 'leg_L': {'pitch': 75, 'knee': 95}}),
        (18, {'root_z': 0.07, 'body': {'pitch': 25}, 'arm_R': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'arm_L': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'leg_R': {'pitch': 55, 'knee': 90}, 'leg_L': {'pitch': 55, 'knee': 50}}),
        (24, {'root_z': 0.07, 'body': {'pitch': 25}, 'arm_R': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'arm_L': {'pitch': 62, 'elbow': 15, 'spread': 4},
              'leg_R': {'pitch': 75, 'knee': 95}, 'leg_L': {'pitch': 30, 'knee': 35}})]),
    'plant_rice': dict(th='ดำนา', loop=True, prop={'type': 'rice_seedlings', 'hand': 'L', 'scale': 0.7},
                       keys=[
        (0, {'body': {'pitch': 68}, 'head': {'pitch': -25}, 'leg_R': {'pitch': 8, 'turn': 10, 'knee': 15},
             'leg_L': {'pitch': -8, 'turn': 10, 'knee': 15}, 'arm_L': {'pitch': 60, 'elbow': 50, 'spread': -5},
             'arm_R': {'pitch': 55, 'elbow': 20, 'spread': 5}}),
        (12, {'body': {'pitch': 75}, 'head': {'pitch': -25}, 'leg_R': {'pitch': 8, 'turn': 10, 'knee': 15},
              'leg_L': {'pitch': -8, 'turn': 10, 'knee': 15}, 'arm_L': {'pitch': 60, 'elbow': 50, 'spread': -5},
              'arm_R': {'pitch': 95, 'elbow': 5, 'spread': 2}}),
        (24, {'body': {'pitch': 68}, 'head': {'pitch': -25}, 'leg_R': {'pitch': 8, 'turn': 10, 'knee': 15},
              'leg_L': {'pitch': -8, 'turn': 10, 'knee': 15}, 'arm_L': {'pitch': 60, 'elbow': 50, 'spread': -5},
              'arm_R': {'pitch': 55, 'elbow': 20, 'spread': 5}})]),
    'harvest': dict(th='เกี่ยวข้าว', loop=True, prop={'type': 'sickle', 'hand': 'R', 'rot': (0, 0, -60)}, keys=[
        (0, {'body': {'pitch': 45, 'turn': -10}, 'head': {'pitch': -15}, 'leg_R': {'pitch': 15, 'knee': 25},
             'leg_L': {'pitch': -10, 'knee': 20}, 'arm_L': {'pitch': 75, 'elbow': 20, 'spread': -10},
             'arm_R': {'pitch': 40, 'elbow': 60, 'spread': 25}}),
        (10, {'body': {'pitch': 48, 'turn': 12}, 'head': {'pitch': -15}, 'leg_R': {'pitch': 15, 'knee': 25},
              'leg_L': {'pitch': -10, 'knee': 20}, 'arm_L': {'pitch': 75, 'elbow': 20, 'spread': -10},
              'arm_R': {'pitch': 70, 'elbow': 40, 'spread': -25, 'twist': 30}}),
        (24, {'body': {'pitch': 45, 'turn': -10}, 'head': {'pitch': -15}, 'leg_R': {'pitch': 15, 'knee': 25},
              'leg_L': {'pitch': -10, 'knee': 20}, 'arm_L': {'pitch': 75, 'elbow': 20, 'spread': -10},
              'arm_R': {'pitch': 40, 'elbow': 60, 'spread': 25}})]),
    'hoe': dict(th='ขุดดิน / ทำไร่', loop=True, prop={'type': 'hoe', 'hand': 'R', 'rot': (-90, 0, 0), 'at': (0, 0, 0)},
                note='the hoe follows the right hand; the left hand rests near it', keys=[
        (0, {'body': {'pitch': 15}, 'leg_R': {'pitch': 20, 'knee': 15}, 'leg_L': {'pitch': -15, 'knee': 10},
             'arm_R': {'pitch': 150, 'elbow': 40, 'spread': -10}, 'arm_L': {'pitch': 140, 'elbow': 50, 'spread': -20}}),
        (12, {'body': {'pitch': 35}, 'leg_R': {'pitch': 20, 'knee': 25}, 'leg_L': {'pitch': -15, 'knee': 15},
              'arm_R': {'pitch': 55, 'elbow': 10, 'spread': -10}, 'arm_L': {'pitch': 50, 'elbow': 20, 'spread': -20}}),
        (36, {'body': {'pitch': 15}, 'leg_R': {'pitch': 20, 'knee': 15}, 'leg_L': {'pitch': -15, 'knee': 10},
              'arm_R': {'pitch': 150, 'elbow': 40, 'spread': -10}, 'arm_L': {'pitch': 140, 'elbow': 50, 'spread': -20}})]),
    'water': dict(th='รดน้ำ / ทำสวน', loop=True, prop={'type': 'watering_can', 'hand': 'R'}, keys=[
        (0, {'body': {'pitch': 8}, 'head': {'pitch': -10}, 'arm_R': {'pitch': 45, 'elbow': 20, 'spread': 10}}),
        (24, {'body': {'pitch': 12}, 'head': {'pitch': -15}, 'arm_R': {'pitch': 50, 'elbow': 20, 'spread': 10,
                                                                      'twist': -35}}),
        (48, {'body': {'pitch': 8}, 'head': {'pitch': -10}, 'arm_R': {'pitch': 45, 'elbow': 20, 'spread': 10}})]),
    'pick': dict(th='เก็บผลไม้', loop=True, prop={'type': 'fruit_basket', 'hand': 'L', 'at': (0, 0, -0.05)}, keys=[
        (0, {'head': {'pitch': -25}, 'arm_R': {'pitch': 160, 'elbow': 10, 'spread': 10},
             'arm_L': {'pitch': 30, 'elbow': 70, 'spread': -5}}),
        (18, {'head': {'pitch': -30}, 'body': {'pitch': -5}, 'arm_R': {'pitch': 170, 'elbow': 25, 'spread': 0},
              'arm_L': {'pitch': 30, 'elbow': 70, 'spread': -5}}),
        (36, {'head': {'pitch': -10}, 'arm_R': {'pitch': 60, 'elbow': 90, 'spread': -20},
              'arm_L': {'pitch': 30, 'elbow': 70, 'spread': -5}}),
        (48, {'head': {'pitch': -25}, 'arm_R': {'pitch': 160, 'elbow': 10, 'spread': 10},
              'arm_L': {'pitch': 30, 'elbow': 70, 'spread': -5}})]),
    'takraw': dict(th='เตะตะกร้อ', loop=True, prop={'type': 'takraw_ball', 'hand': 'none', 'at': (0.05, -0.35, 0.45)},
                   note='the ball is placed at the top of the kick; the game moves it', keys=[
        (0, {'body': {'pitch': 5}, 'leg_R': {'pitch': 0, 'knee': 10}, 'arm_R': {'spread': 25, 'elbow': 30},
             'arm_L': {'spread': 25, 'elbow': 30}}),
        (8, {'body': {'pitch': -5, 'roll': 15}, 'leg_R': {'pitch': 45, 'turn': 60, 'knee': 80},
             'leg_L': {'knee': 10}, 'arm_R': {'spread': 50, 'elbow': 30}, 'arm_L': {'spread': 40, 'elbow': 30}}),
        (16, {'body': {'pitch': 5}, 'leg_R': {'pitch': 0, 'knee': 10}, 'arm_R': {'spread': 25, 'elbow': 30},
              'arm_L': {'spread': 25, 'elbow': 30}}),
        (24, {'body': {'pitch': 5}, 'leg_R': {'pitch': 0, 'knee': 10}, 'arm_R': {'spread': 25, 'elbow': 30},
              'arm_L': {'spread': 25, 'elbow': 30}})]),
    'football': dict(th='เตะฟุตบอล', loop=True, prop={'type': 'football', 'hand': 'none', 'at': (0.1, -0.35, 0.11)},
                     keys=[
        (0, {'leg_R': {'pitch': -35, 'knee': 70}, 'arm_L': {'pitch': -20, 'spread': 25},
             'arm_R': {'pitch': 25, 'spread': 15}, 'body': {'pitch': 5}}),
        (8, {'leg_R': {'pitch': 55, 'knee': 10}, 'arm_L': {'pitch': 30, 'spread': 25},
             'arm_R': {'pitch': -25, 'spread': 15}, 'body': {'pitch': -8}}),
        (16, {'leg_R': {'pitch': 0, 'knee': 10}, 'body': {'pitch': 0}}),
        (24, {'leg_R': {'pitch': -35, 'knee': 70}, 'arm_L': {'pitch': -20, 'spread': 25},
              'arm_R': {'pitch': 25, 'spread': 15}, 'body': {'pitch': 5}})]),
    'sit': dict(th='นั่ง', loop=True, prop={'type': 'stool', 'hand': 'none', 'at': (0, 0.05, 0)}, keys=[
        (0, dict(SIT_STOOL, **{'arm_R': {'pitch': 35, 'elbow': 40}, 'arm_L': {'pitch': 35, 'elbow': 40}})),
        (48, dict(SIT_STOOL, **{'arm_R': {'pitch': 35, 'elbow': 40}, 'arm_L': {'pitch': 35, 'elbow': 40},
                                'head': {'turn': 10}})),
        (96, dict(SIT_STOOL, **{'arm_R': {'pitch': 35, 'elbow': 40}, 'arm_L': {'pitch': 35, 'elbow': 40}}))]),
    'sit_floor': dict(th='นั่งพื้น', loop=True, keys=[
        (0, dict(SIT_FLOOR, **{'arm_R': {'pitch': 40, 'elbow': 30, 'spread': 10},
                                'arm_L': {'pitch': 40, 'elbow': 30, 'spread': 10}})),
        (48, dict(SIT_FLOOR, **{'arm_R': {'pitch': 40, 'elbow': 30, 'spread': 10},
                                 'arm_L': {'pitch': 40, 'elbow': 30, 'spread': 10}, 'head': {'pitch': 6}})),
        (96, dict(SIT_FLOOR, **{'arm_R': {'pitch': 40, 'elbow': 30, 'spread': 10},
                                 'arm_L': {'pitch': 40, 'elbow': 30, 'spread': 10}}))]),
    'sweep': dict(th='กวาด', loop=True, prop={'type': 'broom', 'hand': 'R', 'rot': (-25, 0, 0)}, keys=[
        (0, {'body': {'pitch': 20, 'turn': -18}, 'arm_R': {'pitch': 40, 'elbow': 40, 'spread': -15},
             'arm_L': {'pitch': 55, 'elbow': 60, 'spread': -20}, 'leg_R': {'pitch': 10, 'knee': 15}}),
        (18, {'body': {'pitch': 20, 'turn': 18}, 'arm_R': {'pitch': 40, 'elbow': 40, 'spread': -15},
              'arm_L': {'pitch': 55, 'elbow': 60, 'spread': -20}, 'leg_R': {'pitch': 10, 'knee': 15}}),
        (36, {'body': {'pitch': 20, 'turn': -18}, 'arm_R': {'pitch': 40, 'elbow': 40, 'spread': -15},
              'arm_L': {'pitch': 55, 'elbow': 60, 'spread': -20}, 'leg_R': {'pitch': 10, 'knee': 15}})]),
    'cast_net': dict(th='เหวี่ยงแห', loop=False, prop={'type': 'cast_net', 'hand': 'R'}, keys=[
        (0, {'body': {'turn': -40, 'pitch': 10}, 'arm_R': {'pitch': 30, 'spread': 40, 'elbow': 20},
             'arm_L': {'pitch': 50, 'elbow': 60}, 'leg_R': {'knee': 20}, 'leg_L': {'knee': 20}}),
        (14, {'body': {'turn': 35, 'pitch': 5}, 'arm_R': {'pitch': 110, 'spread': -10, 'elbow': 5},
              'arm_L': {'pitch': 100, 'spread': 20, 'elbow': 5}}),
        (30, {'body': {'turn': 10}, 'arm_R': {'pitch': 60, 'elbow': 10}, 'arm_L': {'pitch': 60, 'elbow': 10}})]),
    'paddle': dict(th='พายเรือ', loop=True, prop={'type': 'paddle', 'hand': 'R', 'rot': (-30, 0, 0)},
                   note='sits in a boat (the boat is the game\'s)', keys=[
        (0, dict(SIT_FLOOR, **{'body': {'pitch': 10, 'turn': 20}, 'arm_R': {'pitch': 40, 'elbow': 30, 'spread': 30},
                                'arm_L': {'pitch': 90, 'elbow': 40, 'spread': -10}})),
        (18, dict(SIT_FLOOR, **{'body': {'pitch': 20, 'turn': -10}, 'arm_R': {'pitch': 10, 'elbow': 10, 'spread': 30},
                                 'arm_L': {'pitch': 60, 'elbow': 50, 'spread': -10}})),
        (36, dict(SIT_FLOOR, **{'body': {'pitch': 10, 'turn': 20}, 'arm_R': {'pitch': 40, 'elbow': 30, 'spread': 30},
                                 'arm_L': {'pitch': 90, 'elbow': 40, 'spread': -10}}))]),
    'talk': dict(th='คุยกัน', loop=True, keys=[
        (0, {'head': {'pitch': 0, 'turn': 5}, 'arm_R': {'pitch': 25, 'elbow': 75, 'twist': 10}}),
        (12, {'head': {'pitch': 6, 'turn': 0}, 'arm_R': {'pitch': 35, 'elbow': 85, 'twist': -20}}),
        (24, {'head': {'pitch': -2, 'turn': -5}, 'arm_R': {'pitch': 20, 'elbow': 70, 'twist': 15}}),
        (36, {'head': {'pitch': 4, 'turn': 3}, 'arm_R': {'pitch': 30, 'elbow': 80, 'twist': -10}}),
        (48, {'head': {'pitch': 0, 'turn': 5}, 'arm_R': {'pitch': 25, 'elbow': 75, 'twist': 10}})]),
    'wave': dict(th='โบกมือ', loop=True, keys=[
        (0, {'arm_R': {'pitch': 20, 'spread': 70, 'elbow': 80, 'twist': -20}, 'head': {'turn': 5}}),
        (6, {'arm_R': {'pitch': 20, 'spread': 70, 'elbow': 60, 'twist': 20}}),
        (12, {'arm_R': {'pitch': 20, 'spread': 70, 'elbow': 80, 'twist': -20}, 'head': {'turn': 5}}),
        (18, {'arm_R': {'pitch': 20, 'spread': 70, 'elbow': 60, 'twist': 20}}),
        (24, {'arm_R': {'pitch': 20, 'spread': 70, 'elbow': 80, 'twist': -20}, 'head': {'turn': 5}})]),
    'wai': dict(th='ไหว้', loop=False, keys=[
        (0, {}),
        (10, {'arm_R': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38},
              'arm_L': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38}, 'head': {'pitch': 15},
              'body': {'pitch': 10}}),
        (30, {'arm_R': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38},
              'arm_L': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38}, 'head': {'pitch': 15},
              'body': {'pitch': 10}}),
        (40, {})]),
    'sell': dict(th='ขายของ', loop=True, keys=[
        (0, {'body': {'pitch': 8}, 'arm_R': {'pitch': 40, 'elbow': 50, 'spread': -5},
             'arm_L': {'pitch': 30, 'elbow': 60, 'spread': -10}, 'head': {'turn': -10}}),
        (24, {'body': {'pitch': 12}, 'arm_R': {'pitch': 55, 'elbow': 35, 'spread': 0, 'twist': 20},
              'arm_L': {'pitch': 30, 'elbow': 60, 'spread': -10}, 'head': {'turn': 10}}),
        (48, {'body': {'pitch': 8}, 'arm_R': {'pitch': 40, 'elbow': 50, 'spread': -5},
              'arm_L': {'pitch': 30, 'elbow': 60, 'spread': -10}, 'head': {'turn': -10}})]),
}
