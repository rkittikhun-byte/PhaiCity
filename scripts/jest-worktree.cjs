// Jest config for a git worktree that has no node_modules of its own: the project is the current folder, and three and
// the other packages come from the main folder (PHAICITY_MAIN). Never link node_modules into a worktree (GEMINI.md).
const path = require("path");
const main = process.env.PHAICITY_MAIN || "D:/DesktopServer/www/phaicity";
const base = require(path.join(main, "jest.config.cjs"));
module.exports = {
  ...base,
  rootDir: process.cwd(),
  collectCoverage: false,
  moduleDirectories: ["node_modules", path.join(main, "node_modules")],
  moduleNameMapper: { ...base.moduleNameMapper, "^three$": path.join(main, "node_modules/three/build/three.module.js") },
};
