import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import HtmlWebpackPlugin  from 'html-webpack-plugin';
import path from 'path';

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
const HANDLE_TYPESCRIPT_WITH_TS_LOADER = { test: /\.([cm]?ts|tsx)$/, loader: "ts-loader" };

const OUTPUT_DIRECTORY = 'dist';

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

function injectBuildIdIntoNameLicense(gitHash) {
  return new HtmlWebpackPlugin({
    gitHash,
    inject: false,
    hash: true,
    template: './name_license.html',
    filename: 'name_license.html'
  });
}

function addDevelopmentConfigTo(options) {
  options.devServer = {
    static: { directory: path.resolve(__dirname, OUTPUT_DIRECTORY) }
  };

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
      'geo-review': './src/geoReview/geoReview.ts',
    },
    resolve: {
      extensions: ADD_TS_EXTENSIONS_TO_WEPACK,
      extensionAlias: SUPPORT_FULLY_QUALIFIED_TS_ESM_IMPORTS,
    },
    module: {
      rules: [
        { ...HANDLE_TYPESCRIPT_WITH_TS_LOADER, exclude: path.resolve(__dirname, 'src/render3d') },
        {
          ...HANDLE_TYPESCRIPT_WITH_TS_LOADER,
          include: path.resolve(__dirname, 'src/render3d'),
          options: { compilerOptions: { module: 'esnext', moduleResolution: 'node' } },
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
      injectGeoReviewBundle(),
      injectBuildIdIntoAbout(buildId),
      injectBuildIdIntoNameLicense(buildId),
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
