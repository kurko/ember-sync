var EmberSyncQueueModel = require('lib/ember-sync/ember-sync-queue-model').default;
var EmberSync = require('lib/ember-sync').default;

var subject,
    onlineStore, offlineStore;

module("Unit - Lib/EmberSync", {
  setup: function() {

    offlineStore = Ember.Object.create();
    onlineStore = Ember.Object.create();

    subject = EmberSync.create({
      offlineStore: offlineStore,
      onlineStore:  onlineStore
    });
  }
});

test("#queueModel - returns the queue model", function() {
  equal(subject.queueModel, EmberSyncQueueModel, "queue model is returned");
});
