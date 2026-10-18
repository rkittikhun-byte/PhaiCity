/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Writes css/theme.css from src/theme/tokens.ts (docs/STYLE_GUIDE.md): `npm run theme:css`. Node 22.18+ reads the
// TypeScript file directly, as it only uses erasable type syntax and imports nothing.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeCss } from '../../src/theme/tokens.ts';

const out = fileURLToPath(new URL('../../css/theme.css', import.meta.url));
writeFileSync(out, themeCss());
console.log(`Wrote ${out}`);
