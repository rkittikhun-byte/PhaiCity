# The era vehicles: Blender to the game

For the AI session (or person) that works on the vehicles next. Read the game's `CLAUDE.md`, `docs/3d/MODEL_SPEC.md`
and `art/buildings/IMPORT.md` first; this file only covers what is special about the vehicles.

## Done (22 Oct 2026, ไม้ไผ่38)

Owner (22 Oct 2026): "รถที่มาวิ่ง ... ให้วิ่งตามยุค ตามสมัยได้ไหม คนก็เหมือนกัน บ้านเรือนก็เหมือนกัน".

- **Blender** (`scripts/`): the kit reuses `art/buildings/scripts/lib` (palette, `mesh.Part`, `kit`, `scene`) and adds
  its own colours (`v_*`, `vlib.VCOLORS`). `vlib.py`: wheels (car, spoked, wooden cart wheel, drone rotor), riders and
  walkers, draught animals (buffalo, zebu ox), plates with a made-up pattern, lamps, mirrors, door lines, side
  profiles (`shell`) and glass cabins (`greenhouse`). `vbodies.py`: the pickup, the box bus, the step-through
  motorcycle, the bonneted truck front and the car, which several eras build on. `vehicles/era<n>.py`: one function a
  vehicle, registered with its class (budget), paints, speed against a car (`slow`) and flying height (`fly`).
- 31 vehicles in five sets (`blend/era<n>_vehicles.blend`, each vehicle an asset; `previews/era<n>_vehicles.png`).
  Rail (the steam engine, the elevated train, the maglev) and the boats of the sheets are not here: they belong to the
  railway and the water.
- **Units:** metres, Blender Z up, the front at -Y, the origin the middle of the footprint on the ground; glTF Y up
  with the front at **+Z**, as the game's cars drive.
- **Export** (`scripts/export_game.py`, `./run.sh export`): `assets/models/vehicles/era<n>/<kind>.glb` (Draco, no
  normals, vertex colours, about 5-10 KB each, 330 KB in all) with meshes `body`, `paint` (the faces in the kind's
  first paint, white; the game tints each car), `lights` (headlamps, tail lights, the future's light strips: lit at
  night) and `wheel0`, `wheel1` ... (one wheel of each set at the origin). `index.json` lists each vehicle's class,
  size, triangles, paints (sRGB hex), `slow`, `fly` and its wheel sets (radius, axis `x` a wheel or `z` a rotor, and
  every position in glTF metres). Budgets: `GAME_BUDGET` (body) and `WHEELS_BUDGET` in `eraVehicles.ts`.
- **Game** (`src/render3d/city/eraVehicles.ts`): `ERA_MIX` and `REGION_MIX` (what drives in each era and region, by
  shares), `transitVehicle` (the era's bus; the north's red songthaew in eras 2-3; the shuttle in era 5),
  `nextEraShare` (the share of `map.buildingEras` already in the next era: that share of the cars take the next era's
  mix), `paintFor` (songthaew colours by region), `EraVehicles` (loads each glb once, with a lighter copy from
  meshoptimizer, `lod.ts`) and `VehiclePool` (one InstancedMesh a part, level and wheel set; wheels turn by the
  distance driven, rotors spin). Used by `tripCars.ts` (the trips' cars; flyers fly over their routes), `buses.ts`
  (transit) and `pedestrians.ts` `CityRoadTraffic` (the wandering cars where there are no trips), wired in
  `index.ts`. Until the models load, and in headless tests, the procedural cars drive as before.
- **Gallery:** `era-buildings.html`, group "Vehicles": the era and region's mix with its shares, or every vehicle of
  the era, wheels turning.
- **Tests:** `test/render3d/eraVehicles.test.ts` (mixes, regions, transition, budgets, sizes, the pool) and the era
  cases in `test/render3d/tripCars.test.ts`.

## Moving parts and traffic (23 Oct 2026, ไม้ไผ่38)

Owner (23 Oct 2026): "คนและรถที่มาวิ่งในโปรแกรม มันควรจะมี direction เดินไปข้างหน้าเท่านั้น และรถไม่ควรจะซ้อนกันคันกัน ...
เกวียน วัวเทียมเกวียน ขาไม่ขยับ ล้อก็ไม่หมุน ไปได้ยังไง".

- **Moving parts** (`vlib.V.wheel` turns, `vlib.V.swing` swings): wheels, the bicycle's and samlor's cranks (radius =
  wheel x gear 2.4, so the crank turns slower than the wheel), the etan's flywheel, drone rotors (axis z, by time); the
  buffalo's and ox's legs (pivot at the shoulder or hip, the diagonal pairs together, 1.4 m a cycle), the hand-cart
  puller's legs (1.1 m a cycle) and the cyclists' pedalling legs (a cycle a crank turn). Each set is one mesh at its
  pivot; the index gives `motion` (`spin` or `swing`), `radius`, or `amplitude`, `phase` (one a position) and `stride`.
  The game turns them by the distance driven (`eraVehicles.ts moverAngle`), so a standing vehicle stands still.
- **Front markers:** the index's `markers` give the mean glTF z of the headlamps, tail lights, the animal, the puller's
  hat and the flying taxi's light strip; `test/render3d/eraVehicles.test.ts` checks every vehicle's front is +Z.
- **Traffic** (`src/render3d/city/laneTraffic.ts`): the trip cars and the transit buses drive as cars of one traffic:
  each keeps a gap behind the car ahead in its lane and slows to its speed (the intelligent driver model), changes to a
  free lane to pass where the road has two a way, and waits its turn at a junction of three roads or more (one road at
  a time; a car waiting more than 8 s goes). Cars are bucketed by segment, way and lane: no pair is compared across the
  town. The month's trips still set how many cars and how fast each road goes; `tripCars.ts lanePathOf` makes a way.
  The wandering cars of a map with no trips keep one pace a lane, evenly spaced (`pedestrians.ts CityRoadTraffic`).
- **People** (`pedestrians.ts`): commuters walk out and back at 1.1 m/s facing the way they go (they walked home
  backwards before), joggers at 2.4 m/s, every step cycle from the distance walked (`WALK_STRIDE_M`, `JOG_STRIDE_M`).
- **Jams** (owner: "แล้วรถติด ก็ต้องมี"): each road's speed is the month's trips' load on it at this hour (busiest-hour
  cars x `hourShare`, through `segmentSeconds`, the trips' own slowing curve), and so is how many cars a route has out
  (its cars an hour x its time now); a junction where one of its roads is over `SIGNAL_LOAD` (0.6) full gets signals
  (`LaneTraffic.setSignal`: roads straight across from each other share a turn of green, 11 s each, 2.5 s all-red),
  where the queues stand. In the live city at 07:30: 116 cars, 48 standing in queues, the 221%-full road crawling at
  1.4 m/s, 22 junctions signalled; at 02:00: 18 cars, none standing, the same road at 7.9 m/s, no signals.
- **Every mover on a trip** (owner: "ทุก object ที่เกิดขึ้น ต้องมีที่มาและที่ไป"): a trip car carries a `CarTrip` (a home of
  its route's group, a workplace or shop of its destination's, purpose, homeward), comes out at its home's place on
  the road and turns in at its destination's (`LaneCar.stop`); `TripCars.tripAt(x, z, reach)` finds one for a click.
  Walkers (`tripWalkers.ts`) walk a city home to a workplace or shop within 450 m (or back), along the pavement of the
  road graph's way, and go in when they arrive (`WalkTrip`, `TripWalkers.tripAt`); on a real-scale city map they take
  the place of the to-and-fro commuters and joggers, and the wandering cars are gone. Province maps (no road graph)
  keep the old wandering cars and walkers.

- **On the road's surface** (owner: "รถวิ่งหรือเกวียน มันจมลงไปในถนนครึ่งล้อ ... มันควรจะเป็นไปตามถนน"): roads are laid
  0.15 world units over the ground they lie on, with a laterite road's crown and tracks and a higher junction patch
  (roadBuild.ts). `roadSurfaceLift` / `roadSurfaceHeight` give the same height; trip cars sit on it under their front
  and back axles and both sides and tilt with slope and crown (`TripCars.onRoad`), and walkers and buses stand on it.

## Next

- The rail vehicles of the sheets (steam engine, elevated train, maglev) for `railTrains.ts`, and the boats for the
  canals and rivers.
