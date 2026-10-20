/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The simplifier alone from meshoptimizer (MIT, Arseny Kapoulkine), by the package's own subpath, which the TypeScript
// module resolution of this project does not read from the package's exports (lod.ts loads it)
declare module 'meshoptimizer/simplifier' {
  export { MeshoptSimplifier } from 'meshoptimizer';
}
