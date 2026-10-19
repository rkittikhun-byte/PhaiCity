# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 4, the modern city (assets/concept/people_era4_v3.jpg)."""

from .shared import STRAPS

STRAP_R = {'arm_R': {'pitch': 8, 'elbow': 115, 'spread': 2}}

CHARACTERS = [
    dict(id='era4_office_woman', th='พนักงานออฟฟิศหญิง', en='Office worker with a shoulder bag', kind='woman',
         hair='bun', top={'type': 'collar', 'color': 'sky', 'sleeve': 'short', 'tuck': True},
         bottom={'type': 'pencil', 'color': 'navy'}, shoes='heels',
         extras=[{'type': 'shoulder_bag', 'color': 'black', 'side': -1, 'w': 0.24, 'h': 0.2}], pose=STRAP_R),
    dict(id='era4_office_man', th='พนักงานออฟฟิศชาย', en='Office worker with a laptop bag', kind='man',
         hair='spiky', top={'type': 'collar', 'color': 'sky', 'sleeve': 'elbow', 'tuck': True},
         bottom={'type': 'trousers', 'color': 'navy', 'belt': 'black'}, shoes='shoes',
         extras=[{'type': 'shoulder_bag', 'color': 'black', 'side': -1, 'w': 0.26, 'h': 0.2}], pose=STRAP_R),
    dict(id='era4_delivery_rider', th='ไรเดอร์ส่งอาหาร', en='Food delivery rider', kind='woman',
         hair='ponytail', hat={'type': 'helmet', 'color': 'light_grey'},
         top={'type': 'hoodie', 'color': 'purple', 'sleeve': 'long'}, bottom={'type': 'trousers', 'color': 'black'},
         shoes='sneakers', shoe_color='navy', extras=[{'type': 'delivery_box', 'color': 'light_grey'}],
         pose=STRAPS, swing_arms=False),
    dict(id='era4_tourist', th='นักท่องเที่ยวสะพายกล้อง', en='Tourist with a camera', kind='man',
         hair={'style': 'spiky', 'color': 'hair_brown'},
         top={'type': 'collar', 'color': 'cream', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'khaki'},
         shoes='sandals', socks='white', extras=['camera']),
    dict(id='era4_uni_student', th='นักศึกษา', en='University student', kind='woman', hair='bun',
         top={'type': 'blouse', 'color': 'white', 'sleeve': 'short', 'tuck': True},
         bottom={'type': 'pleated', 'color': 'black'}, shoes='student',
         extras=[{'type': 'belt', 'color': 'black'}],
         props=[{'type': 'book', 'hand': 'L', 'at': (-0.02, -0.03, 0.06), 'rot': (0, 0, 70), 'color': 'navy'}],
         pose={'arm_L': {'pitch': 15, 'elbow': 100, 'spread': -14}}),
    dict(id='era4_jogger', th='คนวิ่งออกกำลังกาย', en='Jogger', kind='man', hair='spiky',
         top={'type': 'tshirt', 'color': 'teal', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'black'},
         shoes='sneakers', socks='white', extras=['watch'],
         pose={'body': {'pitch': 8}, 'arm_R': {'pitch': -35, 'elbow': 85}, 'arm_L': {'pitch': 40, 'elbow': 85},
               'leg_R': {'pitch': 30, 'knee': 45}, 'leg_L': {'pitch': -20, 'knee': 35}}),
    dict(id='era4_homeless', th='คนไร้บ้าน', en='Homeless man sitting', kind='man', hair='messy',
         face={'beard': True}, top={'type': 'jacket', 'color': 'leather', 'sleeve': 'long', 'inner': 'grey'},
         bottom={'type': 'trousers', 'color': 'charcoal'}, shoes='sandals', root_z=-0.45,
         props=[{'type': 'bindle', 'hand': 'none', 'at': (-0.38, 0.05, 0.56)}],
         pose={'head': {'pitch': 12}, 'arm_R': {'pitch': 75, 'elbow': 25, 'spread': -6},
               'arm_L': {'pitch': 75, 'elbow': 25, 'spread': -6},
               'leg_R': {'pitch': 115, 'knee': 145}, 'leg_L': {'pitch': 115, 'knee': 145}}, swing_arms=False),
]

LINEUP = ['era4_office_woman', 'era4_office_man', 'era4_delivery_rider', 'era4_tourist', 'era4_uni_student',
          'era4_jogger', 'era4_homeless', 'monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
