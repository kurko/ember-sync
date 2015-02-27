import StoreInitMixin           from './store-initialization-mixin';
import RecordForSynchronization from './record-for-synchronization';

export default Ember.Object.extend(
  StoreInitMixin, {

  jobRecord:  null,

  init: function() {
    this._super();
    this.set("debug", false);
    if (this.get('debug')) {
      console.log("[DEBUG] EmberSync.Job#init: jobRecord", this.get('jobRecord'));
    }
  },

  perform: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      _this.synchronizeOnline().then(function() {
        resolve();
      }, function() {
        reject();
      }, "Aust: job#perform() for jobId " + _this.get('jobRecord.id'));
    });
  },

  synchronizeOnline: function(options) {
    var recordPromise,
        operation = this.get('jobRecord.operation'),
        _this = this;

    if (this.get('debug')) {
      console.log("[DEBUG] EmberSync.Job#perform -> #synchronizeOnline: operation", operation);
    }

    if (operation == "delete") {
      recordPromise = this.deletion();
    } else {
      recordPromise = this.save();
    }

    recordPromise.then(function(record) {
      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Job#synchronizeOnline: record saved");
      }
    }, function(error) {
      if (_this.get('debug')) {
        console.error(error);
      }
    });

    return this.commitChangesOnline(recordPromise);
  },

  save: function() {
    var _this = this,
        record, recordForSynchronization;

    return this.findOfflineRecord().then(function(offlineRecord) {
      recordForSynchronization = RecordForSynchronization.create({
        offlineStore:  _this.offlineStore,
        onlineStore:   _this.onlineStore,
        offlineRecord: offlineRecord,
        jobRecord:     _this.get('jobRecord'),
      });

      return recordForSynchronization.toEmberData();
    }, function() {
      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Job#save - record doesn't exist anymore");
      }

      recordForSynchronization = RecordForSynchronization.create({
        offlineStore: _this.offlineStore,
        onlineStore:  _this.onlineStore,
        jobRecord:    _this.get('jobRecord'),
      });

      return recordForSynchronization.toEmberData();
    }, "Aust: job#save() for job "+ _this.get('jobRecord.id'));
  },

  deletion: function() {
    var _this = this,
        type = this.get('jobRecord.jobRecordType'),
        id = this.get('jobRecord.serialized.id');

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var record, preExisting;

      preExisting = _this.onlineStore.hasRecordForId(type, id);
      if (preExisting) {
        preExisting = _this.onlineStore.recordForId(type, id);
        preExisting.rollback();
        _this.onlineStore.unloadAll(type);
      }

      record = _this.onlineStore.push(type, {id: id});
      record.deleteRecord();
      resolve(record);
    });
  },

  commitChangesOnline: function(record) {
    var _this = this;

    if (window.FORCE_SYNC_FAILURE) {
      return Ember.RSVP.reject({message: "Forced failure", stack: ":)"});
    }

    return record.then(function(record) {

      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Job#commitChangesOnline record", record);
      }
      return record.save();
    }).then(function(record) {

      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Job#commitChangesOnline was saved online!", record.id);
      }
      return Ember.RSVP.resolve();
    }, function(error) {

      if (_this.get('debug')) {
        console.error(error);
      }
      return Ember.RSVP.reject(error);
    }, "Aust: job#synchronizeOnline() for job "+ _this.get('jobRecord.id'));
  },

  findOfflineRecord: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var record,
          recordType = _this.get('jobRecord.jobRecordType'),
          recordId   = _this.get('jobRecord.serialized.id');

      if (_this.get('originalOfflineRecord')) {
        resolve(_this.get('originalOfflineRecord'));
        return true;
      }
      record = _this.offlineStore.find(recordType, recordId);
      record.then(function(record) {
        _this.set('originalOfflineRecord', record);
        resolve(record);
      }, function() {
        reject();
      });
    });
  },

  /**
   * Memoizes the original offline record.
   */
  originalOfflineRecord: null
});
