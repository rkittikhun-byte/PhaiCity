# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The northeast: Isan (assets/concept/people_isan.jpg)."""

from .shared import HOLD_FRONT

TO_MOUTH = {'arm_R': {'pitch': 70, 'elbow': 105, 'spread': -22}, 'arm_L': {'pitch': 70, 'elbow': 105, 'spread': -22}}

CHARACTERS = [
    dict(id='isan_sticky_rice_woman', th='แม่ถือกระติบข้าวเหนียว', en='Woman with a sticky-rice basket',
         kind='woman', hair='bun', hat={'type': 'ngob'},
         top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals', props=[{'type': 'kratip', 'hand': 'both', 'at': (0, -0.04, -0.05)}], pose=HOLD_FRONT,
         swing_arms=False),
    dict(id='isan_khaen_player', th='หมอแคน', en='Khaen player', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'scarf_check', 'color': 'cloth_red', 'check': 'cream'}],
         props=[{'type': 'khaen', 'hand': 'both', 'at': (0.02, -0.06, 0.03), 'rot': (0, -10, 0)}], pose=TO_MOUTH,
         swing_arms=False),
    dict(id='isan_silk_spinner', th='แม่สาวไหม', en='Silk spinner with a spool', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'maroon', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'band': 'sky'}, shoes='sandals',
         props=[{'type': 'thread_spool', 'hand': 'both', 'at': (0, -0.04, 0.02)}], pose=HOLD_FRONT,
         swing_arms=False),
    dict(id='isan_buffalo_boy', th='เด็กเลี้ยงควายถือเชือก', en='Buffalo boy with a rope', kind='boy', hair='spiky',
         top={'type': 'mandarin', 'color': 'mustard', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'brown'},
         shoes='sandals', props=[{'type': 'rope_coil', 'hand': 'L'}],
         pose={'arm_L': {'pitch': 15, 'elbow': 25, 'spread': 10}}),
    dict(id='isan_papaya_salad', th='แม่ค้าส้มตำ', en='Papaya salad maker with a mortar', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'rose', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'black', 'stripes': ['stripe_pink', 'stripe_pink']}, shoes='sandals',
         props=[{'type': 'mortar', 'hand': 'both', 'at': (0, -0.05, -0.08)}], pose=HOLD_FRONT, swing_arms=False),
    dict(id='isan_fish_trap_boy', th='หนุ่มถือไซ', en='Young man with a fish trap', kind='boy', hair='spiky',
         proportions={'leg': 0.46, 'torso': 0.42},
         top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'scarf_check', 'color': 'cream', 'check': 'plaid_red'}],
         props=[{'type': 'fish_trap', 'hand': 'R', 'at': (0, 0, -0.08), 'rot': (0, 25, 0)}],
         pose={'arm_R': {'pitch': 10, 'elbow': 10, 'spread': 14}}),
    dict(id='isan_grandma_box', th='ยายถือกล่องหมาก', en='Grandmother with a betel box', kind='woman',
         hair={'style': 'bun', 'color': 'hair_grey'}, face={'blush': False},
         top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='shoes', shoe_color='dark_brown',
         props=[{'type': 'wooden_box', 'hand': 'both', 'at': (0, -0.03, 0.02), 'color': 'wood_dark'}],
         pose=HOLD_FRONT, swing_arms=False),
]

LINEUP = ['isan_sticky_rice_woman', 'isan_khaen_player', 'isan_silk_spinner', 'isan_buffalo_boy',
          'isan_papaya_salad', 'isan_fish_trap_boy', 'isan_grandma_box', 'monk', 'schoolboy', 'schoolgirl']
