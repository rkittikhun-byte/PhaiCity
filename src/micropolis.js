/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import $ from "jquery";

import { Config } from './config.js';
import { installAudio } from './audio/index.ts';
import { applyTranslations, getLanguage, onLanguageChange, setLanguage } from './i18n/index.ts';
import { setLoadingProgress, trackImages } from './loadingProgress.ts';
import { stagger } from './motion.ts';
import { installPanelCollapse } from './panelCollapse.ts';
import { SplashScreen } from './splashScreen.js';
import { TileSet } from './tileSet.js';
import { TileSetURI } from './tileSetURI.ts';
import { TileSetSnowURI } from './tileSetSnowURI.ts';
import { installHudTooltips } from './hudTooltip.ts';
import { installToolShortcuts } from './toolShortcuts.ts';

/*
 *
 * Our task in main is to load the tile image, create a TileSet from it, and then tell the SplashScreen to display
 * itself. We will never return here.
 *
 */


var fallbackImage, tileSet, snowTileSet;


var onTilesLoaded = function() {
  var snowTiles = $('#snowtiles')[1];
  snowTileSet = new TileSet(snowTiles, onAllTilesLoaded, onFallbackTilesLoaded);
};


var onAllTilesLoaded = function() {
  // Kick things off properly
  var sprites = $('#sprites')[0];
  if (sprites.complete) {
    $('#loadingBanner').css('display', 'none');
    var s = new SplashScreen(tileSet, snowTileSet, sprites);
  } else {
     window.setTimeout(onAllTilesLoaded, 0);
  }
};


// XXX Replace with an error dialog
var onFallbackError = function() {
  fallbackImage.onload = fallbackImage.onerror = null;
  alert('Failed to load tileset!');
};


var onFallbackSnowLoad = function() {
  fallbackImage.onload = fallbackImage.onerror = null;
  snowTileSet = new TileSet(fallbackImage, onAllTilesLoaded, onFallbackError);
};


var onFallbackTilesLoaded = function() {
  fallbackImage = new Image();
  fallbackImage.onload = onFallbackSnowLoad;
  fallbackImage.onerror = onFallbackError;
  fallbackImage.src = TileSetSnowURI;
};


var onFallbackLoad = function() {
  fallbackImage.onload = fallbackImage.onerror = null;
  tileSet = new TileSet(fallbackImage, onFallbackTilesLoaded, onFallbackError);
};


var tileSetError = function() {
  // We might be running locally in Chrome, which handles the security context of file URIs differently, which makes
  // things go awry when we try to create an image from a "tainted" canvas (one we've painted on). Let's try creating
  // the tileset by URI instead
  fallbackImage = new Image();
  fallbackImage.onload = onFallbackLoad;
  fallbackImage.onerror = onFallbackError;
  fallbackImage.src = TileSetURI;
};


// The game area ends where the footer starts, so the credits in the footer are never covered by the map.
// The footer's height changes with the window width and the language.
var fitGameAreaToFooter = function() {
  var footer = document.getElementById('footer');
  document.documentElement.style.setProperty('--footer-height', footer.offsetHeight + 'px');
};


// The gold loading line: the script has arrived, now the tile and sprite images (0.1 to 0.7)
setLoadingProgress(0.1);
trackImages(Array.prototype.slice.call(document.querySelectorAll('img.imageData')), 0.1, 0.7);

// Show the page in the player's language (Thai unless they chose English), and let them switch at any time
applyTranslations();
fitGameAreaToFooter();

// Menus and buttons slide in one after another (css/style.css, "Motion")
['#miscButtons .miscButton', '#buttons .toolButton'].forEach(function(selector) {
  stagger(document, selector);
});
window.addEventListener('resize', fitGameAreaToFooter, false);
onLanguageChange(function() {
  fitGameAreaToFooter();
  // Let the game canvas pick up its new size
  window.dispatchEvent(new Event('resize'));
});
$('#languageToggle').click(function(e) {
  e.preventDefault();
  setLanguage(getLanguage() === 'th' ? 'en' : 'th');
});

// Sound starts after the player's first click or key press (browsers block it before then)
installAudio();

// Every game panel can slide away to its side of the screen
installPanelCollapse();
// 1–9 pick tools and P pauses (src/toolShortcuts.ts)
installToolShortcuts();
// Quick small tooltips on everything in the game that has a title (src/hudTooltip.ts)
installHudTooltips();


// Check for debug parameter in URL
Config.debug = window.location.search.slice(1).split('&').some(function(param) {
  return param.trim().toLowerCase() === 'debug=1';
});


var tiles = $('#tiles')[0];
tileSet = new TileSet(tiles, onTilesLoaded, tileSetError);
var snowtiles = $('#snowtiles')[1];
