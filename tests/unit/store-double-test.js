var StoreDouble = require('lib/ember-sync/store-double').default;

var subject, serialized;

module("Unit - Lib/EmberSync/StoreDouble", {
  setup: function() {
    subject = StoreDouble;
  }
});

test("#dematerializeRecord - does nothing", function() {
  ok(subject.dematerializeRecord());
});

test("#typeMapFor - does nothing", function() {
  ok(subject.typeMapFor('nothing').idToRecord['nothing']);
});
