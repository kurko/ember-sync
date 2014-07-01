'use strict';

var path = require('path');
var fs = require('fs');

function EmberCLIEmberSync(project) {
  this.project = project;
  this.name    = 'Ember CLI Ember Sync';
}

function unwatchedTree(dir) {
  return {
    read:    function() { return dir; },
    cleanup: function() { }
  };
}

EmberCLIEmberSync.prototype.included = function(app) {
  this.app = app;

  this.app.import('vendor/ember-sync.js', {
    exports: {
      'ember-sync': ['default']
    }
  });
};

EmberCLIEmberSync.prototype.treeFor = function(name) {
  var treePath;
  if (name === 'vendor') {
    treePath = path.join(__dirname, '..', 'dist');
  } else if(name === 'app') {
    treePath = path.join(__dirname, '..', 'app-addon');
  }

  if (treePath && fs.existsSync(treePath)) {
    return unwatchedTree(treePath);
  }
};

module.exports = EmberCLIEmberSync;
