/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The month's trips worked out in a worker (docs/NO_GRID_PLAN.md 1.4, 4.6): the page's side (workerTripRunner, a
// TripRunner for the core, src/sim/cityTrips.ts) and what the worker does with each job (tripsReply,
// src/sim/trips-worker.ts). The worker runs the same monthTrips on the same job, so its answer is the one the page would
// have worked out; the core brings it into the city half a month after the month's start either way, and works it out
// itself then if the worker is not back (a slow machine, a worker that could not start), so the city is the same.

import type { TripRunner } from "./cityTrips";
import { monthTrips, type TripJob, type TripResult } from "./trips";

export interface TripsRequest { id: number; job: TripJob }
export interface TripsReply { id: number; result: TripResult }

/** The worker's answer to a job, and the arrays it hands over without copying */
export function tripsReply(request: TripsRequest): { reply: TripsReply; transfer: ArrayBuffer[] } {
  const result = monthTrips(request.job);
  const transfer: ArrayBuffer[] = [result.cars.buffer, result.seconds.buffer, result.homeToWork.buffer,
    result.homeToShop.buffer, result.jobToHome.buffer, ...result.routes.map((r) => r.segments.buffer)] as ArrayBuffer[];
  return { reply: { id: request.id, result }, transfer };
}

/** What the page needs of a worker */
export interface TripWorkerLike {
  postMessage(data: TripsRequest): void;
  onmessage: ((event: { data: TripsReply }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/**
 * A TripRunner that sends each month's job to a worker (made by `make`, once, when the first job comes) and calls back
 * with its answer; one that never answers (it failed to start or errored) is given up, and the core works the month out
 * itself when its step comes (src/sim/cityTrips.ts TripSystem.step).
 */
export function workerTripRunner(make: () => TripWorkerLike): TripRunner & { dispose(): void } {
  let worker: TripWorkerLike | null = null, broken = false, next = 1;
  const waiting = new Map<number, (result: TripResult) => void>();
  return {
    start(job, done) {
      if (broken) return;
      if (!worker) {
        try {
          worker = make();
        } catch {
          broken = true;
          return;
        }
        worker.onmessage = ({ data }) => {
          const call = waiting.get(data.id);
          waiting.delete(data.id);
          call?.(data.result);
        };
        worker.onerror = () => { broken = true; waiting.clear(); worker?.terminate(); worker = null; };
      }
      const id = next++;
      // ... only the latest month waited for: an older one's answer is of no use any more
      waiting.clear();
      waiting.set(id, done);
      worker.postMessage({ id, job });
    },
    dispose() {
      waiting.clear();
      worker?.terminate();
      worker = null;
    },
  };
}

/** The game's trips worker in the browser (webpack's city-trips-worker entry) */
export function browserTripWorker(): TripWorkerLike {
  return new Worker(new URL("src/city-trips-worker.js", document.baseURI), { type: "module" }) as unknown as TripWorkerLike;
}
