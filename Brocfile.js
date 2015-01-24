var pickFiles = require('broccoli-static-compiler')
var mergeTrees = require('broccoli-merge-trees')
var env = require('broccoli-env').getEnv();
var compileES6 = require('broccoli-es6-concatenator');
var findBowerTrees = require('broccoli-bower');

var sourceTrees = [];

if (env === 'production') {

  // Build file
  sourceTrees = sourceTrees.concat('vendor')
  var js = new mergeTrees(sourceTrees, { overwrite: true })

  js = compileES6('lib', {
    loaderFile: '../vendor/no_loader.js',
    inputFiles: [
      '**/*.js'
    ],
    wrapInEval: false,
    outputFile: '/ember-sync.js'
  });

  sourceTrees = sourceTrees.concat(js);

} else if (env === 'development') {

  var lib = pickFiles('lib', {
    srcDir: '/',
    destDir: '/lib'
  });

  sourceTrees = sourceTrees.concat(lib)
  sourceTrees = sourceTrees.concat(findBowerTrees())
  sourceTrees = sourceTrees.concat('vendor')
  var js = new mergeTrees(sourceTrees, { overwrite: true })

  js = compileES6(js, {
    loaderFile: 'loader.js',
    inputFiles: [
      'lib/**/*.js'
    ],
    legacyFilesToAppend: [
      'jquery.js',
      'ember.js',
      'localstorage_adapter.js',
    ],
    wrapInEval: true,
    outputFile: '/assets/app.js'
  });

  sourceTrees = sourceTrees.concat(js);

  var tests = pickFiles('tests', {
    srcDir: '/',
    destDir: '/tests'
  })
  sourceTrees.push(tests)

  sourceTrees = sourceTrees.concat(tests);

}
module.exports = mergeTrees(sourceTrees, { overwrite: true });
