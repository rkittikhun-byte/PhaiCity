/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Works a month's trips out off the page (docs/NO_GRID_PLAN.md 1.4), so the game does not stall at a month's start in a
// big city: the page sends the month's job (src/sim/cityTrips.ts), this answers with what the trips found
// (src/sim/trips.ts monthTrips, the very code the page and Node run, so the answer is the same), handing its arrays
// over without copying. The page brings the answer into the city at the step it would have anyway.

import { tripsReply, type TripsRequest, type TripsReply } from "./tripWorker";

const worker = self as unknown as {
  onmessage: (event: MessageEvent<TripsRequest>) => void;
  postMessage: (data: TripsReply, transfer: ArrayBuffer[]) => void;
};
worker.onmessage = ({ data }) => {
  const { reply, transfer } = tripsReply(data);
  worker.postMessage(reply, transfer);
};
