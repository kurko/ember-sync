import StoreInitMixin           from './store-initialization-mixin';
import RecordForSynchronization from './record-for-synchronization';

var debugging = false;

function debug(message, value) {
  if (debugging) {
    if (value) {
      console.log("[DEBUG] EmberSync."+message, value);
    } else {
      console.log("[DEBUG] EmberSync."+message);
    }
  }
}

export default Ember.Object.extend(
  StoreInitMixin, {

  jobRecord:  null,

  init: function() {
    this._super();
    this.set("debug", false);
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

  // FIXME
  // maybe a better name would make sense here, such as:
  //
  // - consolidateRecord
  // - pushRecord
  // - synchronizeRecord
  //
  synchronizeOnline: function(options) {
    var recordPromise, record,
        operation = this.get('jobRecord.operation'),
        _this = this;

    debug("Job#synchronizeOnline: operation", operation);

    return this.findOfflineRecord().then(function(offlineRecord) {
      record = RecordForSynchronization.create({
        onlineSerializer: _this.get('onlineSerializer'),
        onlineAdapter:    _this.get('onlineAdapter'),
        offlineStore:     _this.get('offlineStore'),
        offlineRecord:    offlineRecord,
        jobRecord:        _this.get('jobRecord')
      });

      if (operation == "delete") {
        console.error("record.deleteRemotely not implemented");
        recordPromise = record.deleteRemotely();
      } else if (operation == "create") {
        recordPromise = record.createRemotely();
      } else if (operation == "update") {
        console.error("record.updateRemotely not implemented");
        recordPromise = record.updateRemotely();
      } else {
        // FIXME
        //throw "Unknown operation "+operation;
      }

      recordPromise.then(function(record) {
        debug("Job#synchronizeOnline: record saved");
      }, function(error) {
        debug("Job#synchronizeOnline: record failed to be saved");
      });

      if (window.FORCE_SYNC_FAILURE) {
        return Ember.RSVP.reject({message: "Forced failure", stack: ":)"});
      }

      return recordPromise;
    });
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
