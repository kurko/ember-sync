/**
 * @module ModelDouble
 *
 * Adapters require an object that responds to what Ember Data models respond.
 * Given we use string for `type` and a hash for the record itself, we need
 * to encapsulate it in an object that has the adequate interface for the
 * adapter.
 */
export default function(type, serializedRecord) {
  var typeString,
      model = Ember.Object.extend(serializedRecord || {});

  if (typeof type === 'string') {
    typeString = type;
  } else {
    typeString = type.typeKey;
  }

  return model.create({
    typeKey: typeString,

    relationshipNames: Ember.get(type, 'relationshipNames'),
    typeForRelationship: type.typeForRelationship,

    serialize: function(options) {
      var serialized = serializedRecord;

      if (options && options["includeId"] === false) {
        delete serialized.id;
      }

      return serialized;
    }
  })
}
