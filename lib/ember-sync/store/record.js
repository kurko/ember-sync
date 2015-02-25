export default Ember.Object.extend({
  store: null,
  snapshot: null,

  init: function() {
    this.set('collection', {});
    this._super();
  },
  /**
   * This method will get a snapshot and will return an object with:
   *
   *   * main record serialized
   *   * belongsTo records serialized
   *   * hasMany records serialized
   *
   * The format is the following:
   *
   *   {
   *     'cart': [{
   *       'id': 1,
   *       'customer': 2,
   *     }],
   *     'customer': [{
   *       'id': 2,
   *       'name': 'Alex'
   *     }]
   *   }
   *
   * where the object key is the record's typeKey.
   *
   * That way, when we have something to push into the store, we can use this
   * to figure out everything related to the main record.
   *
   * @method pushableCollection
   * @public
   * @return {object}
   */
  pushableCollection: function() {
    var mainRecordType = this._snapshot().typeKey,
        serializedMainRecord = this.serialize(this._snapshot());

    /**
     * Pushing associations.
     */
    this._serializeAssociations();

    /**
     * Pushes main record.
     */
    this.get('collection')[mainRecordType] = [];
    this.get('collection')[mainRecordType].push(serializedMainRecord);

    return this.get('collection');
  },

  serialize: function(snapshot) {
    var type = snapshot.typeKey;
    return this._serializer(type).serialize(snapshot, { includeId: true });
  },

  /**
   * This method will get every association, serialize it and push into
   * `this.get('collection')`. It will mutate the object's collection property.
   *
   * @method _serializeAssociations
   * @private
   */
  _serializeAssociations: function() {
    var serializedCollection = [],
        _this = this,
        snapshot = this._snapshot();

    snapshot.eachRelationship(function(name, relationship) {
      var hasManyRecords = null;

      var pushToCollection = function(snapshot) {
        var serialized = _this.serialize(snapshot),
            type = snapshot.typeKey;

        if (!_this.get('collection')[type]) {
          _this.get('collection')[type] = [];
        }

        _this.get('collection')[type].push(serialized);
      }

      /**
       * Will push belongsTo assocs to the final collection.
       */
      if (relationship.kind === "belongsTo") {
        pushToCollection(snapshot.belongsTo(name));
      }
      /**
       * Pushes hasMany associations into the final collection.
       */
      else if (relationship.kind === "hasMany") {
        hasManyRecords = snapshot.hasMany(name);

        for (var record in hasManyRecords) {
          if (hasManyRecords.hasOwnProperty(record)) {
            pushToCollection(hasManyRecords[record]);
          }
        }
      }
    });
  },

  _store: function() {
    return this.get('store');
  },

  _type: function() {
    return this.get('type');
  },

  _snapshot: function() {
    return this.get('snapshot');
  },

  _serializer: function(type) {
    return this._store().serializerFor(type);
  }
});
