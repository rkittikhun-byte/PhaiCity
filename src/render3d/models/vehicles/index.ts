/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

export { createTrainLoco, createTrainCar } from './train.js';
export { createHelicopter, createAirplane } from './aircraft.js';
export { createShip, createLongtailBoat, createKorlaeBoat } from './watercraft.js';
export {
  createSedan, createPickup, createTuktuk, createMotorbike,
  createSongthaew, createBus, createTruck, createEtan,
} from './road.js';

export const VEHICLE_IDS = [
  'veh.train_loco',
  'veh.train_car',
  'veh.helicopter',
  'veh.airplane',
  'veh.ship',
  'veh.sedan',
  'veh.pickup',
  'veh.tuktuk',
  'veh.motorbike',
  'veh.songthaew',
  'veh.bus',
  'veh.truck',
  'veh.longtail_boat',
  'veh.etan',
  'veh.korlae_boat',
] as const;

export type VehicleId = typeof VEHICLE_IDS[number];
