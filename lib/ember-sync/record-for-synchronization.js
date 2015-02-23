import StoreInitMixin from './store-initialization-mixin';

export default Ember.Object.extend(
  StoreInitMixin, {

  jobRecord:  null,
  offlineStore:  null, // required

  init: function() {
    this._super();
  },

  toEmberData: function() {
    var _this = this,
        record;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      record = _this.createRecordInStore();
      record = _this.setRelationships(record);

      resolve(record);
    });
  },

  createRecordInStore: function() {
    var type = this.get('jobRecord.jobRecordType'),
        operation = this.get('jobRecord.operation'),
        record, properties;

    properties = this.propertiesToPersist();
    this.rollbackExistingRecord();

    if (operation == "create") {
      record = this.onlineStore.createRecord(type, properties);
    } else if (operation == "update") {
      record = this.onlineStore.push(type, properties);
    }
    /**
     * TODO
     *
     * else {
     *   throw("what operation is it?");
     * }
     */

    return record;
  },

  rollbackExistingRecord: function() {
    var existingRecord,
        recordId   = this.get('jobRecord.serialized.id'),
        recordType = this.get('jobRecord.jobRecordType');

    existingRecord = this.onlineStore.hasRecordForId(recordType, recordId);
    if (existingRecord) {
      existingRecord = this.onlineStore.recordForId(recordType, recordId);
      existingRecord.rollback();
      this.onlineStore.unloadAll(recordType);
    } else {
      return false;
    }
  },

  propertiesToPersist: function() {
    var offlineRecord = this.get('offlineRecord'),
        originalSerialized = this.get('jobRecord.serialized'),
        type = this.get('jobRecord.jobRecordType'),
        properties;

     properties = this.serializeWithoutRelationships(type, offlineRecord, originalSerialized);
     return this.setDateObjectsInsteadOfDateString(type, properties);
  },

  setRelationships: function(pendingRecord) {
    var _this = this,
        offlineRecord = this.get('offlineRecord'),
        type = this.get('jobRecord.jobRecordType');

    /**
     * We need to loop relationships. If no record was
     * passed in, we need to create a new one, fake, so we know about the
     * relationships.
     */
    if (!offlineRecord) {
      offlineRecord = this.onlineStore.push(type, {id: 1});
    }

    offlineRecord.eachRelationship(function(name, descriptor) {
      var key = descriptor.key,
          kind = descriptor.kind,
          type = descriptor.type,
          relation, onlineRelation;

      /**
       * TODO - implement for when `.get(relation)` returns a Promise.
       */
      relation = offlineRecord.get(name);

      /**
       * We need to attach relationships to the main record. If the
       * relationships don't exist anymore offline, we need to generate a new
       * one, fake, with the same ID, just to send to the server.
       */
      if (kind == "belongsTo") {
        var relationId = _this.get('jobRecord.serialized')[name];

        if (relationId && !relation) {
          relation = _this.onlineStore.push(type, {id: relationId});
        }

        if (relation) {
          onlineRelation = _this.generateRelationForRecord(type, relation);
          pendingRecord.set(key, onlineRelation);
        }
      } else if (kind == "hasMany") {
        relation.forEach(function(relation) {
          onlineRelation = _this.generateRelationForRecord(type, relation);
          pendingRecord.get(name).pushObject(onlineRelation);
        });
      }
    });

    return pendingRecord;
  },

  generateRelationForRecord: function(type, relation) {
    var serializedRelation = this.serializeWithoutRelationships(type, relation);
    return this.onlineStore.push(type.typeKey, serializedRelation);
  },

  serializeWithoutRelationships: function(type, record, serialized) {
    var serializedCopy;

    if (!serialized) {
      serialized = record.serialize({includeId: true});
    }

    serializedCopy = JSON.parse(JSON.stringify(serialized));
    /**
     * We need to get relationships off the serialization. If no record was
     * passed in, we need to create a new one, fake, so we know about the
     * relationships.
     */
    if (!record) {
      record = this.onlineStore.push(type, {id: 1});
    }
    record.eachRelationship(function(name, descriptor) {
      delete serializedCopy[name];
    });

    return serializedCopy;
  },

  setDateObjectsInsteadOfDateString: function(type, serialized) {
    var fakeRecord = this.get('offlineStore').createRecord(type);

    fakeRecord.eachAttribute(function(attr, details) {
      if (details.type == "date" && typeof serialized[attr]) {
        if (serialized[attr]) {
          serialized[attr] = new Date(Date.parse(serialized[attr]));
        } else {
          throw "WAT?"
          //serialized[attr] = new Date(Date.parse(fakeRecord.get('createdAt')));
        }
      }
    });

    return serialized;
  }
});
