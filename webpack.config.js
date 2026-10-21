import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import HtmlWebpackPlugin  from 'html-webpack-plugin';
import path from 'path';
import { addAdminRoutes } from './scripts/admin/adminServer.mjs';
import { addArtRoutes } from './scripts/art/artServer.mjs';

// Workaround now this is a module...
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const StripAssertionCode = require('ts-transformer-unassert').default;

const ADD_TS_EXTENSIONS_TO_WEPACK = [".ts", ".tsx", ".js"];
const SUPPORT_FULLY_QUALIFIED_TS_ESM_IMPORTS = {
  ".js": [".js", ".ts"],
  ".cjs": [".cjs", ".cts"],
  ".mjs": [".mjs", ".mts"],
};
// Type errors are reported only for files in the bundle, so a test file never puts the dev server's error overlay over
// the game
const HANDLE_TYPESCRIPT_WITH_TS_LOADER = { test: /\.([cm]?ts|tsx)$/, loader: "ts-loader", options: { onlyCompileBundledFiles: true } };

const OUTPUT_DIRECTORY = 'dist';

// TypeScript compiled as ES modules, so that its three.js imports reach the same module build as the 3D code's (the
// CommonJS build would be a second copy of three.js, and it reads Node's process): the 3D code, and the art export
// page that builds its models
const ES_MODULE_TYPESCRIPT = [
  path.resolve(__dirname, 'src/render3d'),
  path.resolve(__dirname, 'src/admin/artExport.ts'),
];

function recursivelyCopy(dir) {
  return {from: dir, to: dir, toType: 'dir'};
}

function cleanUpLeftovers() {
  return new CleanWebpackPlugin();
}

function copyStaticAssets() {
  return new CopyPlugin({
    "patterns": [
      recursivelyCopy('css'),
      recursivelyCopy('images'),
      recursivelyCopy('sprites'),
      // Raw sound downloads (assets/audio/_raw/, gitignored) stay out of the build.
      {from: 'assets', to: 'assets', toType: 'dir', globOptions: {ignore: ['**/_raw/**']}},
      // Province data and preset maps, fetched at runtime; raw downloads stay out of the build.
      {from: 'data', to: 'data', toType: 'dir', globOptions: {ignore: ['**/cache/**']}},
      'LICENSE',
      'COPYING',
      // The icon (art/icon, scripts/icon/export.mjs); its PNGs come with assets/
      'favicon.ico',
      'manifest.webmanifest',
    ]
  });
}

function injectGeoReviewBundle() {
  return new HtmlWebpackPlugin({
    template: './geo-review.html',
    filename: 'geo-review.html',
    chunks: ['geo-review'],
    inject: true,
    hash: true,
  });
}

function injectBundleIntoHTML(gitHash) {
  return new HtmlWebpackPlugin({
    gitHash,
    inject: true,
    hash: true,
    template: './index.html',
    chunks: ['micropolis'],
    filename: 'index.html'
  });
}

function injectBuildIdIntoAbout(gitHash) {
  return new HtmlWebpackPlugin({
    gitHash,
    inject: true,
    hash: true,
    template: './about.html',
    chunks: ['about'],
    filename: 'about.html'
  });
}

function injectGalleryBundle() {
  return new HtmlWebpackPlugin({
    template: './model-gallery.html',
    filename: 'model-gallery.html',
    chunks: ['model-gallery'],
    inject: true,
    hash: true,
  });
}

function injectSoundGalleryBundle() {
  return new HtmlWebpackPlugin({
    template: './sound-gallery.html',
    filename: 'sound-gallery.html',
    chunks: [],
    inject: false,
    hash: true,
  });
}

// Every era building by era and region (art/buildings, src/render3d/gallery/era-buildings.ts)
function injectEraBuildingsBundle() {
  return new HtmlWebpackPlugin({
    template: './era-buildings.html',
    filename: 'era-buildings.html',
    chunks: ['era-buildings'],
    inject: true,
    hash: true,
  });
}

function injectBuildIdIntoNameLicense(gitHash) {
  return new HtmlWebpackPlugin({
    gitHash,
    inject: false,
    hash: true,
    template: './name_license.html',
    filename: 'name_license.html'
  });
}

// The owner's admin page (rules and resources of every region and province, docs/PROVINCE_PROFILE.md): built only
// for the dev server, whose endpoint saves into data/; never part of a release
function injectAdminBundle() {
  return new HtmlWebpackPlugin({
    template: './admin.html',
    filename: 'admin.html',
    chunks: ['admin'],
    inject: true,
    hash: true,
  });
}

// The art export page (every 3D model as glTF files in the art archive outside the project, docs/3d/ART_ARCHIVE.md):
// built only for the dev server, whose endpoint writes the files; never part of a release
function injectArtExportBundle() {
  return new HtmlWebpackPlugin({
    template: './art-export.html',
    filename: 'art-export.html',
    chunks: ['art-export'],
    inject: true,
    hash: true,
  });
}

function addDevelopmentConfigTo(options) {
  options.devServer = {
    static: { directory: path.resolve(__dirname, OUTPUT_DIRECTORY), serveIndex: false },
    setupMiddlewares: (middlewares, devServer) => {
      addAdminRoutes(devServer.app, __dirname);
      addArtRoutes(devServer.app, __dirname);
      return middlewares;
    },
  };
  options.entry.admin = './src/admin/adminPage.ts';
  options.plugins.push(injectAdminBundle());
  options.entry['art-export'] = './src/admin/artExport.ts';
  options.plugins.push(injectArtExportBundle());

  options.devtool = 'source-map';
  options.mode = 'development';
}

function addProductionConfigTo(options) {
  /*
  const assertionStrippingConfig = {
    options: {
      getCustomTransformers: () => {
        return ({before: [StripAssertionCode]});
      }
    }
  };
  stripTSAssertionsRule = Object.assign(assertionStrippingConfig, HANDLE_TYPESCRIPT_WITH_ATL);
  options.module.rules.push(stripTSAssertionsRule);
  */
}

function getBuildId() {
  // Technically don't need to use the webpack plugin, as not passing it to Webpack...
  const gitPlugin = new GitRevisionPlugin({
    commitHashCommand: `log -1 --pretty=format:'%h' main`
  });

  return gitPlugin.commithash().slice(0, 12);
}

function commonOptions() {
  const buildId = getBuildId();

  const options = {
    entry: {
      micropolis: './src/micropolis.js',
      about: './src/aboutPage.ts',
      'model-gallery': './src/render3d/gallery/gallery.ts',
      'city-model-worker': './src/render3d/city/model-worker.ts',
      'city-road-worker': './src/render3d/city/road-worker.ts',
      'geo-review': './src/geoReview/geoReview.ts',
      'era-buildings': './src/render3d/gallery/era-buildings.ts',
    },
    resolve: {
      extensions: ADD_TS_EXTENSIONS_TO_WEPACK,
      extensionAlias: SUPPORT_FULLY_QUALIFIED_TS_ESM_IMPORTS,
    },
    module: {
      rules: [
        { ...HANDLE_TYPESCRIPT_WITH_TS_LOADER, exclude: ES_MODULE_TYPESCRIPT },
        {
          ...HANDLE_TYPESCRIPT_WITH_TS_LOADER,
          include: ES_MODULE_TYPESCRIPT,
          options: { onlyCompileBundledFiles: true, compilerOptions: { module: 'esnext', moduleResolution: 'node' } },
        },
      ],
    },
    output: {
      path: path.resolve(__dirname, OUTPUT_DIRECTORY),
      filename: 'src/[name].js'
    },
    plugins: [
      cleanUpLeftovers(),
      copyStaticAssets(),
      injectBundleIntoHTML(buildId),
      injectGalleryBundle(),
      injectSoundGalleryBundle(),
      injectGeoReviewBundle(),
      injectBuildIdIntoAbout(buildId),
      injectBuildIdIntoNameLicense(buildId),
      injectEraBuildingsBundle(),
    ],
  };

  return options;
}

export default function(env, argv) {
  let options = commonOptions();

  if (argv.mode === 'development') {
    addDevelopmentConfigTo(options);
  } else {
    addProductionConfigTo(options);
  }

  return options;
};
