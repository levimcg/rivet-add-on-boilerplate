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

// Get the current year for copyright in the banner
const currentYear = new Date().getFullYear();

// Create the string for the verion number banner.
const banner = `/*! ${package.name} - @version ${package.version}

* Copyright (c) ${currentYear} TheTrustees of Indiana University

* Licensed under the BSD 3-Clause License.

* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided that the following conditions are met:
*   1.Redistributions of source code must retain the above copyright notice,
*   this list of conditions and the following disclaimer.
*   2.Redistributions in binary form must reproduce the above copyright notice,
*   this list of conditions and the following disclaimer in the documentation
*   and/or other materials provided with the distribution.
*   3.Neither the name of the copyright holder nor the names of its
*   contributors may be used to endorse or promote products derived from
*   this software without specific prior written permission.
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
* POSSIBILITY OF SUCH DAMAGE.
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
        name: package.component,
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
