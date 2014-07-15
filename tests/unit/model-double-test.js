var ModelDouble = require('lib/ember-sync/model-double').default;

var subject, serialized;

module("Unit - Lib/EmberSync/ModelDouble", {
  setup: function() {
    serialized = {
      id:    "abc",
      total: "5.0"
    };

    subject = ModelDouble('inventoryItem', serialized);
  },

  tearDown: function() {
    subject = null;
  }
});

test("instantiates without a data hash", function() {
  subject = ModelDouble('inventoryItem');
  ok(subject, "instantiated");
});

test("#serialize - returns Ember.Object with serialize()", function() {
  equal(subject.id,    "abc", "id returns abc");
  equal(subject.total, "5.0", "total returns 5.0");
  equal(subject.serialize(), serialized, "#serialized");
  equal(subject.serialize({includeId: true}), serialized, "#serialized with id");
  deepEqual(subject.serialize({includeId: false}), {total: "5.0"}, "#serialized without ID");
});

test("#typeKey - returns string when type string is passed in", function() {
  equal(subject.typeKey, "inventoryItem", "subject.typeKey returns string");
});

test("#typeKey - returns string when actual model is passed in", function() {
  subject = ModelDouble({typeKey: 'inventoryItem'});
  equal(subject.typeKey, "inventoryItem", "subject.typeKey returns string");
});

test("#relationshipNames - returns the model relationships", function() {
  subject = ModelDouble({relationshipNames: 'relationships'});
  equal(subject.relationshipNames, "relationships", "returns function");
});

test("#typeForRelationship - returns the relationship type", function() {
  subject = ModelDouble({typeForRelationship: 'relationships'});
  equal(subject.typeForRelationship, "relationships", "returns function");
});
