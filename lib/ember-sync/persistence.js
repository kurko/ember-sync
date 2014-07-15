import StoreInitMixin           from './store-initialization-mixin';
import RecordForSynchronization from './record-for-synchronization';
import Queue                    from './queue';

export default Ember.Object.extend(
  StoreInitMixin, {

  /**
   * Saves a record offline and adds the synchronization to the queue.
   *
   * The record must have been created using EmberSync.createRecord().
   *
   * @method save
   * @param {DS.Model} record
   */
  save: function(record) {
    var _this = this,
        operation      = this.persistenceOperation(record),
        offlinePromise = record.save(),
        type           = record.emberSync.get('recordType'),
        properties     = record.emberSync.get('recordProperties') || {},
        isNew          = record.get('isNew');

    offlinePromise.then(function(offlineRecord) {
      var job, queue;

      properties = offlineRecord.serialize({includeId: true});

      queue = Queue.create({
        onlineSerializer: _this.get('onlineSerializer'),
        onlineAdapter:    _this.get('onlineAdapter'),
        offlineStore:     _this.get('offlineStore')
      });
      return queue.enqueue(type, properties, operation);
    });

    return offlinePromise;
  },

  /**
   * Persists a given record found online into the offline store.
   *
   * @method persistRecordOffline
   * @param {string} type
   * @param {DS.Model} record
   */
  persistRecordOffline: function(typeString, serializedRecord) {
    var offlineSerializer = this.offlineStore.serializerFor(typeString),
        type = this.offlineStore.modelFor(typeString),
        model, recordForSynchronization;

        debugger;
    recordForSynchronization = RecordForSynchronization.create({
      onlineAdapter: this.get('onlineAdapter')
    });
    recordForSynchronization.setDateObjectsInsteadOfDateString(type, serializedRecord);

    model = this.offlineStore.push(type, serializedRecord);
    return model.save();
  },

  persistenceOperation: function(record) {
    if (record.get('currentState.stateName') == "root.deleted.uncommitted") {
      return "delete";
    } else if (record.get('isNew')) {
      return "create";
    } else {
      return "update";
    }
  },
});
