/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Builds the roads' and railways' shapes off the page (owner, 19 Oct 2026: "บันทึก เป็น background"), so the game never
// stalls while a road is drawn: the page sends the map and the ground (roadCurves.ts), this answers with the arrays to
// show, handing them over without copying, and keeps each line it built for the next request (roadBuild.ts).
import { RoadWorkerState, type RoadReply, type RoadRequest } from './roadBuild.js';

const worker = self as unknown as { onmessage: (event: MessageEvent<RoadRequest>) => void; postMessage: (data: RoadReply, transfer: ArrayBuffer[]) => void };
const state = new RoadWorkerState();
worker.onmessage = ({ data }) => {
  const { reply, transfer } = state.handle(data);
  worker.postMessage(reply, transfer);
};
