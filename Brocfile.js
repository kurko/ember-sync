var pickFiles = require('broccoli-static-compiler')
var mergeTrees = require('broccoli-merge-trees')
var env = require('broccoli-env').getEnv();
var compileES6 = require('broccoli-es6-concatenator');
var findBowerTrees = require('broccoli-bower');

var lib = pickFiles('lib', {
  srcDir: '/',
  destDir: '/lib'
});

var sourceTrees = [lib, 'vendor'];
sourceTrees = sourceTrees.concat(findBowerTrees())

var js = new mergeTrees(sourceTrees, { overwrite: true })

js = compileES6(js, {
  loaderFile: 'loader.js',
  inputFiles: [
    'lib/**/*.js'
  ],
  legacyFilesToAppend: [
    'jquery.js',
    'ember.js',
    'ember-data.js',
    'localstorage_adapter.js',
  ],
  wrapInEval: env !== 'production',
  outputFile: '/assets/app.js'
});

sourceTrees = sourceTrees.concat(js);

if (env !== 'production') {
  var tests = pickFiles('tests', {
    srcDir: '/',
    destDir: '/tests'
  })
  sourceTrees.push(tests)

  sourceTrees = sourceTrees.concat(tests);
}

module.exports = mergeTrees(sourceTrees, { overwrite: true });
