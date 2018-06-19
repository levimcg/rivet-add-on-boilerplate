const gulp = require('gulp');
const gutil = require('gulp-util');
const cp = require('child_process');
const sass = require('gulp-sass');
const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const externalHelpers = require('babel-plugin-external-helpers');
const browserSync = require('browser-sync').create();
const header = require('gulp-header');
const runSequence = require('run-sequence');
const uglify = require('gulp-uglify');
const pump = require('pump');
const rename = require('gulp-rename');
const postcss = require('gulp-postcss');
const cssnano = require('gulp-cssnano');
const autoprefixer = require('autoprefixer')
const package = require('./package.json');

// Create the string for the verion number banner.
const banner = '/*! ' + package.name + ' - @version v' + package.version + ' */' + '\n' + '\n';

// Development server
gulp.task('serve', function () {
  browserSync.init(
    ['docs/css/**/*.css', 'docs/js/**/*.js', 'docs/**/*.html'],
    {
      server: {
        baseDir: './docs'
      }
    }
  );

  gulp.watch('src/sass/**/*.scss', ['sass']);
  gulp.watch('src/js/**/*.js', ['js']);
});

gulp.task('eleventy', function (cb) {
  cp.exec('npx eleventy', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  })
})

gulp.task('eleventy:watch', function () {
  const eleventy = cp.spawn('npx', ['eleventy', '--watch']);

  const eleventyLogger = function (buffer) {
    buffer.toString()
      .split(/\n/)
      .forEach((message) => gutil.log('Eleventy: ' + message));
  };

  eleventy.stdout.on('data', eleventyLogger);
  eleventy.stderr.on('data', eleventyLogger);
})

gulp.task('sass', function () {
  return gulp
    .src('src/sass/**/*.scss')
    .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
    .pipe(gulp.dest('docs/css/'));
});

gulp.task('sass:watch', function() {
  gulp.watch('src/sass/**/*.scss', ['sass']);
});

gulp.task('js', () => {
  return rollup
    .rollup({ input: './src/js/' + package.name + '.js', plugins: [babel()] })
    .then(bundle => {
      return bundle.write({
        file: './docs/js/' + package.name + '.js',
        format: 'umd',
        /**
         * Change this property to the namespace you want you're component
         * to have. For example "Widget". Then it's public methods should
         * be available as Widget.init().
         */
        name: 'MyComponent',
        sourcemap: true
      });
    })
});

gulp.task('js:watch', function() {
  gulp.watch('src/js/**/*.js', ['js']);
});

gulp.task('js:copy', function() {
  return gulp.src('./docs/js/**/*.js')
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task('js:header', function() {
  gulp.src('./dist/js/' + package.name + '.js')
    .pipe(header(banner, { package: package }))
    .pipe(gulp.dest('./dist/js/'));

  gulp.src('./dist/js/' + package.name + '.min.js')
    .pipe(header(banner, { package: package }))
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task("js:minify", function(done) {
  pump(
    [
      gulp.src('dist/js/' + package.name + '.js'),
      uglify(),
      rename({ suffix: '.min' }),
      gulp.dest('dist/js')
    ],
    done
  );
});

gulp.task('js:release', function(done) {
  runSequence(
    'js',
    'js:copy',
    'js:minify',
    'js:header',
    done
  );
});

gulp.task('css:copy', function() {
  return gulp.src('./docs/css/**/*.css')
    .pipe(gulp.dest('./dist/css/'));
});

// TODO: finish minification, autoprefixing, etc. for CSS
gulp.task('css:minify', function () {
  return gulp.src('dist/css/' + package.name + '.css')
    .pipe(cssnano())
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('css:prefix', function () {
  return gulp.src('dist/css/' + package.name + '.css')
    .pipe(postcss([autoprefixer({ browsers: ['last 2 versions'] })]))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('css:header', function () {
  gulp.src('dist/css/' + package.name + '.css')
    .pipe(header(banner, { package: package }))
    .pipe(gulp.dest('dist/css/'));

  gulp.src('dist/css/' + package.name + '.min.css')
    .pipe(header(banner, { package: package }))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('css:release', function(done) {
  runSequence(
    'sass',
    'css:copy',
    'css:prefix',
    'css:minify',
    'css:header',
    done
  );
});

gulp.task('release', ['js:release', 'css:release']);

gulp.task('watch', ['eleventy:watch', 'sass:watch', 'js:watch']);

gulp.task('default', ['serve', 'watch']);