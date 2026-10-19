# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The central plain (assets/concept/people_central.jpg)."""

from .shared import HOLD_FRONT
from .era2 import CHEST

CHARACTERS = [
    dict(id='central_boat_vendor', th='แม่ค้าตลาดน้ำ', en='Floating-market vendor', kind='woman', hair='bun',
         hat={'type': 'ngob'}, top={'type': 'mandarin', 'color': 'pink', 'sleeve': 'elbow'},
         bottom={'type': 'sin', 'color': 'navy', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals',
         props=[{'type': 'paddle', 'hand': 'R'},
                {'type': 'boat', 'hand': 'none', 'at': (-0.1, 0.45, 0), 'rot': (0, 0, 20), 'length': 1.4}],
         pose={'arm_R': {'pitch': 35, 'elbow': 55, 'spread': 4}}, swing_arms=False),
    dict(id='central_pole_boatman', th='คนถ่อเรือ', en='Boatman with a punting pole', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'pole', 'hand': 'L', 'length': 1.9, 'grip': 0.95}],
         pose={'arm_L': {'pitch': 40, 'elbow': 40, 'spread': 4}}, swing_arms=False),
    dict(id='central_rice_harvester', th='ชาวนาเกี่ยวข้าว', en='Rice harvester', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'rice_sheaf', 'hand': 'R', 'rot': (-40, 0, 0)},
                {'type': 'sickle', 'hand': 'L', 'rot': (0, 0, 60)}],
         pose={'arm_R': {'pitch': 30, 'elbow': 70, 'spread': -15}, 'arm_L': {'pitch': 40, 'elbow': 60, 'spread': -10}},
         swing_arms=False),
    dict(id='central_abacus_woman', th='แม่ค้าดีดลูกคิด', en='Shopkeeper with an abacus', kind='woman',
         hair='bun', top={'type': 'mandarin', 'color': 'maroon', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='shoes', props=[{'type': 'abacus', 'hand': 'both', 'at': (0, -0.05, 0.03), 'rot': (-10, 0, 0)}],
         pose=CHEST, swing_arms=False),
    dict(id='central_noodle_seller', th='คนขายก๋วยเตี๋ยวรถเข็น', en='Noodle cart seller', kind='man', hair='spiky',
         top={'type': 'collar', 'color': 'cream', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='shoes', extras=[{'type': 'apron', 'color': 'leather'}],
         props=[{'type': 'noodle_cart', 'hand': 'none', 'at': (0.62, 0.05, 0), 'rot': (0, 0, -90)}],
         pose={'arm_L': {'pitch': 45, 'elbow': 30, 'spread': -10}}),
    dict(id='central_net_fisher', th='ชาวประมงถือแห', en='Fisherman with a cast net', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'long'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals',
         props=[{'type': 'cast_net', 'hand': 'R', 'at': (0, 0, 0.02)}],
         pose={'arm_R': {'pitch': 35, 'elbow': 45, 'spread': -5}, 'arm_L': {'pitch': 35, 'elbow': 60, 'spread': -15}},
         swing_arms=False),
    dict(id='central_malai_dancer', th='หญิงชุดไทยถือพวงมาลัย', en='Woman in Thai dress with a garland',
         kind='woman', hair='bun_flower', top={'type': 'kebaya', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'band': 'stripe_gold'}, shoes='shoes',
         extras=[{'type': 'shawl', 'color': 'rose'}, {'type': 'belt', 'color': 'gold'}],
         props=[{'type': 'malai', 'hand': 'R'}],
         pose={'arm_R': {'pitch': 30, 'elbow': 30, 'spread': 20}, 'arm_L': {'pitch': 60, 'elbow': 30, 'spread': 40}},
         swing_arms=False),
]

LINEUP = ['central_boat_vendor', 'central_pole_boatman', 'central_rice_harvester', 'central_abacus_woman',
          'central_noodle_seller', 'central_net_fisher', 'central_malai_dancer', 'monk', 'schoolboy', 'schoolgirl']
