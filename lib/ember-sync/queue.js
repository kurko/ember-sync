import StoreInitMixin from './store-initialization-mixin';
import Job            from './job';

var queueTimer = null,
    testing = window.TEST,
    supressConsoleErrors = true,
    forceSyncFailure = false;

export default Ember.Object.extend(
  StoreInitMixin, {

  init: function() {
    this._super();
    this.set('pendingJobs', Ember.A());
    this.set('retryOnFailureDelay', 10000);
    this.set('emptyQueueRetryDelay', 5000);
    //this.set('debug', true);
    this.set('isError', null);

    if (!this.get('onError')) {
      this.set('onError', function() {});
    }

    if (testing) {
      this.set('beginQueueProcessingDelay', 1)
    } else {
      this.set('beginQueueProcessingDelay', 500)
    }
  },

  isError: null,

  retryOnFailureDelay: null,
  emptyQueueRetryDelay: null,

  enqueue: function(type, properties, operation) {
    var job, adapter;

    job = this.offlineStore.createRecord(this.queueModel(), {
      jobRecordType: type,
      operation:     operation,
      createdAt:     (new Date).toUTCString(),
      serialized:    properties
    });
    adapter = this.offlineStore.adapterFor(type);
    adapter.createRecord(null, this.queueModel(), job);
    job.deleteRecord();
  },

  pendingJobs: null,

  process: function() {
    var _this = this,
        jobs;

    Em.run.cancel(queueTimer);

    jobs = this.offlineStore.find(this.queueModel());
    jobs.then(function(jobs) {
      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Queue:", jobs.get('length')+" jobs found");
      }

      /**
       * TODO - shouldn't push duplicated jobs
       */
      _this.set('pendingJobs', Ember.A(jobs));
      var processTimer = Em.run.later(function() {
        _this.processNextJob();
      }, _this.get('beginQueueProcessingDelay'));

      _this.setProcessTimer(processTimer);
    }, function() {
      var processTimer = Em.run.later(function() {
        _this.process();
      }, _this.get('emptyQueueRetryDelay'));

      _this.setProcessTimer(processTimer);
    });
  },

  processNextJob: function() {
    var _this = this,
        job, jobRecord;

    /**
     * TODO - If there are no jobs, we should not return, but continue the
     * loop.
     */
    if (!this.get('pendingJobs.length')) {
      if (_this.get('debug')) {
        console.log("[DEBUG] EmberSync.Queue#processNextJob: no jobs pending");
      }

      if (!testing) {
        var processTimer = Em.run.later(function() {
          _this.process();
        }, 3500);

        _this.setProcessTimer(processTimer);
      }
      return true;
    }

    jobRecord = this.get('pendingJobs').objectAt(0);

    console.log('omg onlineadapter', this.get('onlineAdapter'));
    job = Job.create({
      offlineStore:     this.get('offlineStore'),
      onlineSerializer: this.get('onlineSerializer'),
      onlineAdapter:    this.get('onlineAdapter'),
      jobRecord:        jobRecord
    });

    if (_this.get('debug')) {
      console.log("[DEBUG] EmberSync.Queue#processNextJob: jobRecord", jobRecord);
    }

    job.perform().then(function() {
      _this.set('isError', false);

      _this.removeJobFromQueue(jobRecord).then(function() {
        var processTimer = Em.run.later(function() {
          _this.processNextJob();
        }, 1);

        _this.setProcessTimer(processTimer);
      });
    }, function() {
      if (!supressConsoleErrors || _this.get('debug')) {
        console.error("Queue#processNextJob: job #"+jobRecord.get('id')+" not performed.");
      }

      /**
       * Makes errors be called only once per job trial.
       */
      if (!_this.get('isError') && !testing) {
        Em.run(function() {
          _this.onError();
        });
      }
      _this.set('isError', true);

      if (!testing) {
        var processTimer = Em.run.later(function() {
          _this.processNextJob();
        }, _this.get('retryOnFailureDelay'));

        _this.setProcessTimer(processTimer);
      }
    }, "Aust: queue#processNextJob() for jobId "+jobRecord.id);
  },

  setProcessTimer: function(reference) {
    if (queueTimer)
      Em.run.cancel(queueTimer);

    queueTimer = reference;
  },

  removeJobFromQueueArray: function(job) {
    var newQueue;

    newQueue = this.get('pendingJobs').reject(function(pendingJob) {
      if (!pendingJob.get('id')) {
        return false;
      }

      return pendingJob.get('id') == job.get('id');
    });

    this.set('pendingJobs', newQueue);
  },

  removeJobFromQueue: function(job) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      job.destroyRecord().then(function() {
        _this.removeJobFromQueueArray(job);
        resolve();
      }, function() {
        console.error('Error deleting EmberSync job #'+job.get('id'));
        reject();
      });
    });
  },

  queueModel: function() {
    return this.offlineStore.modelFor('emberSyncQueueModel');
  }
});
