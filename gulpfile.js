const { dest, series, src, watch } = require('gulp');
const gutil = require('gulp-util');
const cp = require('child_process');
const sass = require('gulp-sass');
const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const browserSync = require('browser-sync').create();
const header = require('gulp-header');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const postcss = require('gulp-postcss');
const cssnano = require('gulp-cssnano');
const autoprefixer = require('autoprefixer');
const package = require('./package.json');

// Create the string for the verion number banner.
const banner = `/*!
* ${package.name} - @version ${package.version}

* Copyright (C) 2018 The Trustees of Indiana University
* SPDX-License-Identifier: BSD-3-Clause
*/

`;

// Development server
function watchFiles(callback) {
  browserSync.init(['docs/css/**/*.css', 'docs/js/**/*.js', 'docs/**/*.html'], {
    server: {
      baseDir: './docs'
    }
  });
  watch('src/sass/**/*.scss', { ignoreInitial: false }, compileSass);
  watch('src/js/**/*.js', { ignoreInitial: false }, compileJS);

  callback();
}

/**
 * Using Eleventy static site generator to compile Markdown docs
 * into HTML for testing/demo purposes. Uses the Nunjuck templates
 * inside './src/_includes` for layout.
 *
 * More about Eleventy here:
 * https://www.11ty.io/docs/
 *
 * More about Nunjucks here:
 * https://mozilla.github.io/nunjucks/
 */
function compileHTML(callback) {
  cp.exec('npx eleventy', function(err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    callback(err);
  });
}

function watchHTML(callback) {
  const eleventy = cp.spawn('npx', ['eleventy', '--watch']);

  const eleventyLogger = function(buffer) {
    buffer
      .toString()
      .split(/\n/)
      .forEach(message => gutil.log('Eleventy: ' + message));
  };
  eleventy.stdout.on('data', eleventyLogger);
  eleventy.stderr.on('data', eleventyLogger);

  callback();
}

function compileSass() {
  return src('src/sass/**/*.scss')
    .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
    .pipe(dest('docs/css/'));
}

/**
 * Uses Rollup to compile ES6 down to browser JS with a UMD wrapper.
 * See more here:
 * https://rollupjs.org/guide/en#gulp
 */
function compileJS() {
  return rollup
    .rollup({
      input: './src/js/' + package.name + '.js',
      plugins: [babel({ runtimeHelpers: true })]
    })
    .then(bundle => {
      return bundle.write({
        file: './docs/js/' + package.name + '.js',
        format: 'umd',
        name: package.addOnName,
        sourcemap: true
      });
    });
}

function copyJS() {
  return src('./docs/js/**/*.js').pipe(dest('./dist/js/'));
}

function headerJS(callback) {
  src('./dist/js/' + package.name + '.js')
    .pipe(header(banner, { package: package }))
    .pipe(dest('./dist/js/'));

  src('./dist/js/' + package.name + '.min.js')
    .pipe(header(banner, { package: package }))
    .pipe(dest('./dist/js/'));

  callback();
}

function minifyJS() {
  return src('dist/js/' + package.name + '.js')
    .pipe(uglify())
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest('dist/js'));
}

function copyCSS() {
  return src('./docs/css/**/*.css').pipe(dest('./dist/css/'));
}

function minifyCSS() {
  return src('dist/css/' + package.name + '.css')
    .pipe(cssnano())
    .pipe(
      rename({
        suffix: '.min'
      })
    )
    .pipe(dest('dist/css/'));
}

function prefixCSS() {
  return src('dist/css/' + package.name + '.css')
    .pipe(postcss([autoprefixer({ browsers: ['last 2 versions'] })]))
    .pipe(dest('dist/css/'));
}

function headerCSS(callback) {
  src('dist/css/' + package.name + '.css')
    .pipe(header(banner, { package: package }))
    .pipe(dest('dist/css/'));

  src('dist/css/' + package.name + '.min.css')
    .pipe(header(banner, { package: package }))
    .pipe(dest('dist/css/'));

  callback();
}

// Builds the "dist" folder with compiled and minified CSS & JS
exports.release = series(
  compileJS,
  copyJS,
  minifyJS,
  headerJS,
  compileSass,
  copyCSS,
  prefixCSS,
  minifyCSS,
  headerCSS
);

exports.buildDocs = series(compileHTML, compileSass, compileJS);

// Default development task
exports.default = series(watchFiles, watchHTML);
