/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "test/**/*.ts",
  ],
  coverageReporters: ["json", "lcov", "text", "html"],
  moduleFileExtensions: [
    "ts",
    "js",
  ],
  roots: [
    "<rootDir>/src",
    "<rootDir>/test",
  ],
  testEnvironment: "node",
  moduleNameMapper: {
    // r186's CommonJS entry delegates to ESM; transform its canonical ESM entry directly.
    "^three$": "<rootDir>/node_modules/three/build/three.module.js",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transformIgnorePatterns: ["node_modules[/\\\\](?!three[/\\\\])"],
  testMatch: ["**/test/*.ts", "**/test/**/*.ts"],
  transform: {
    "^.+\\.[tj]s$": "ts-jest"
  }
};
