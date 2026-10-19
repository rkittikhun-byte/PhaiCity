# PhaiCity people in Blender: plan and progress

Owner's request (19 Oct 2026): build the people of the concept sheets as 3D in Blender and keep the files to edit
later. **Do not import them into the game yet.** IMPORT.md says how a later session does that. The owner is away and
said "don't ask, just go": work through the checklist on your own and pace the plan's usage (see "Resuming").

- **Concept art** (read only, in the game repo): `D:/DesktopServer/www/phaicity/assets/concept/people_era{1..5}_v3.jpg`
  and `people_{north,isan,central,east,west,south}.jpg`.
- The source lives in the game repo at `art/people/` on main, its only copy (owner, 19 Oct 2026: "merge เข้า main",
  then the first build folder was removed).

## Now

- 19 Oct 2026: all built, in the game repo at `art/people/`, and walking in the game (IMPORT.md "Done"). The era
  variable is `gameMap.era` (`src/era.ts`). Next, when the owner asks: the activity clips at their places (farms,
  sports grounds), and each era's buildings.

## Style (from the concept sheets)

- Chibi people: the head is about a third of the height. Adult 1.50–1.55 m including hair, children about 1.33 m.
- Flat colours from `scripts/lib/palette.py`, a dark ink outline (preview only), warm sun, lavender shadows, sand
  ground.
- Face: two tall dark eye ovals, a small mouth, pink cheeks on women and girls. No nose.
- Low poly. Budget per character about 3,000 triangles with props (Blender source, close-up quality); the game makes
  lighter versions on import (IMPORT.md).
- No brands or logos, no royal or religious symbols on clothes. Monks are people and allowed; no Buddha images.

## Parts (the same for every character)

Blender: Z up, metres, a character faces **-Y**, its right hand on **-X**, its feet on the origin.

```
<id>                empty at the feet (custom properties: phaicity_kind, phaicity_label_th, phaicity_sheet,
 |                    phaicity_swing_arms, phaicity_triangles)
 |- body            origin at the hips  - torso, hips, neck, skirt, sash, bags...      bends at the waist
 |   |- head        origin at the neck  - head, face, hair, hat
 |   |- arm_R       origin at the right shoulder (upper arm, hangs down -Z when not posed)
 |   |   |- forearm_R   origin at the elbow - forearm and hand; props held in this hand
 |   |- arm_L / forearm_L
 |   |- prop_*      held in both hands or worn on the body
 |- leg_R           origin at the right hip (thigh)
 |   |- shin_R      origin at the knee - shin and foot
 |- leg_L / shin_L
 |- prop_*          standing beside the person (boat, cart, robot...)
```

A prop held in one hand is a child of that forearm. A pose is only the rotation of body, head, arms and legs, so one
activity clip (below) fits every character.

## Activities (อิริยาบถ), owner 19 Oct 2026

People in the game do different things. Every clip is made once and works on every character, because all of them
have the same parts. Clips are keyframes of the part rotations (`scripts/clips.py`, built by `scripts/build_clips.py`): a demo person
per clip in `blend/clips.blend`, every clip as a glTF animation in `glb/clips.glb`, and the numbers in `clips.json`.
The motorbike clip waits for the vehicles.

| Clip | Thai | Parts that move | Prop it needs |
|---|---|---|---|
| idle | ยืน | breathe: body, head | - |
| walk | เดิน | legs, arms (unless phaicity_swing_arms is false) | - |
| walk_carry | เดินถือของ | legs only | the character's own |
| run / jog | วิ่ง / วิ่งออกกำลัง | legs, arms, body leans | - |
| bike | ปั่นจักรยาน | legs pedal, arms on the bars, body leans | bicycle |
| plant_rice | ดำนา | body bends 70°, right arm pushes down | rice seedlings |
| harvest | เกี่ยวข้าว | body bends 45°, sickle arm swings | sickle |
| hoe | ขุดดิน / ทำไร่ | body bends, both arms lift and drop | hoe |
| water | รดน้ำ / ทำสวน | arm tilts the can | watering can |
| pick | เก็บผลไม้ | arm reaches up | basket |
| takraw | เตะตะกร้อ | one leg kicks high | rattan ball |
| football | เตะฟุตบอล | leg kicks | football |
| sit | นั่ง | legs bend 90°, root lowered | - |
| sit_floor | นั่งพื้น | legs crossed | - |
| sweep | กวาด | arms sweep | broom |
| cast_net | เหวี่ยงแห | body turns, arms throw | cast net |
| paddle | พายเรือ | arms row (sits in a boat) | paddle |
| talk | คุยกัน | head, one arm gestures | - |
| wave | โบกมือ | one arm waves | - |
| wai | ไหว้ | hands together at the chest | - |
| sell | ขายของ | arms over a stall | stall (later) |

## Checklist

Build a sheet: `blender -b --factory-startup --python-exit-code 1 -P scripts/build.py -- <sheet> [--force]`
(Blender: `D:/Program Files/Blender Foundation/Blender 5.2/blender.exe`). Look at `previews/<sheet>_sheet.png`
beside the concept sheet, fix, rebuild, commit.

- [x] Pipeline: parts, palette, hair, clothes, hats, props, studio, export, previews
- [x] shared: monk, vendor_yoke, schoolboy, schoolgirl (on every sheet)
- [x] era1 built (6): farmer_sickle, seedling_woman, net_fisher, boat_vendor, boy_rope, grandma_box
- [x] Polish pass on the base look (boat hull, shoulders, sheet layout, ground colour)
- [x] era2 (6): woman_abacus, porter_sack, postman, samlor_rider (+ samlor), rail_worker_lantern, teacher_book
- [x] era3 (6): factory_woman_tiffin, factory_man, motorbike_taxi (vest, helmet), cashier_scanner,
      builder_hardhat, office_woman_clipboard
- [x] era4 (7): office_woman_bag, office_man_bag, rider_delivery (helmet, box), tourist_camera, student_uni,
      jogger, homeless_sitting
- [x] era5 (6): woman_tablet, delivery_robot (prop), engineer_glasses, astronaut, farmer_robot (+ farm robot),
      boy_vr
- [x] north (7): lanna_woman, umbrella_painter, tea_picker, akha_woman, wood_carver, bus_driver, sai_ua_vendor
- [x] isan (7): sticky_rice_woman, khaen_player, silk_spinner, buffalo_boy_rope, papaya_mortar, fish_trap_boy,
      isan_grandma_box
- [x] central (7): central_boat_vendor, pole_boatman, rice_harvester, central_abacus, noodle_cart (+ cart),
      central_net_fisher, malai_dancer
- [x] east (6): durian_man, rambutan_woman, gem_inspector, fish_basket_woman, mechanic_overalls, incense_woman
- [x] west (6): rod_fisher, head_basket_woman, loom_weaver (sitting, loom), ladder_man, water_jar_woman,
      paddle_man
- [x] south (7): hijab_roti_woman, kopiah_net_fisher, rubber_tapper, longtail_driver, baba_kebaya_woman,
      coconut_boy, korlae_painter
- [x] Activity props: bicycle, hoe, watering can, broom, rattan ball, football, chair
- [x] Activity clips: blend/clips.blend + clips.json (table above)
- [x] people-library.blend: every character as an asset (Asset Browser), for the owner to browse
- [x] Final check: every preview against its concept, IMPORT.md up to date, summary for the owner (Thai)

## Resuming (usage limits)

A recurring cron in the session (every hour at :17) restarts the work when the plan's 5-hour limit has reset.

- Before each new character, read the usage (`mcp__ccd_session_mgmt__get_usage`).
- 5-hour window at 90% or more: finish the character in hand, commit, write "Now" above, end the turn; the cron
  resumes after the reset.
- Weekly limit at 95%: commit, write "Now", delete the cron, stop until the owner says so.
- Crons live only in the open session: if the app was closed, the owner restarts with "ทำต่อตาม art/people/PLAN.md".
