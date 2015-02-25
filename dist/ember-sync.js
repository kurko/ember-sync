
;define("ember-sync", 
  ["ember-sync/store-initialization-mixin","ember-sync/queue","ember-sync/query","ember-sync/persistence","ember-sync/ember-sync-queue-model","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];
    var Queue = __dependency2__["default"];
    var Query = __dependency3__["default"];
    var Persistence = __dependency4__["default"];
    var QueueModel = __dependency5__["default"];

    __exports__["default"] = Ember.Object.extend(
      StoreInitMixin, {

      onError: function() { },

      /**
       *
       * This is called when a record is added from an online or offline store and
       * pushed to the results array. This will be triggered when using the find or
       * findQuery methods
       *
       * @method onRecordAddded
       */
      onRecordAdded: function(record, type) {
        this.embedThisIntoRecord(record, type);
      },

      queueModel: QueueModel,
      /**
       * Pushes pending record to the server.
       *
       * Whenever you create, updates or deletes a record, a `job` is create in a
       * `queue` in the offline database. Once the internet is available, this queue
       * will be processed and those records will be synchronized with the remote
       * server.
       *
       * This should be called from the ApplicationRoute, e.g.
       *
       *     App.ApplicationRoute = Ember.Route.extend({
       *       init: function() {
       *         this._super();
       *
       *         var emberSync = EmberSync.API.create({container: this});
       *         emberSync.synchronizeOnline();
       *       }
       *     });
       *
       * It will keep running forever (unless otherwise commanded).
       *
       * @method synchronizeOnline
       */
      synchronizeOnline: function() {
        Queue.create({
          offlineStore: this.offlineStore,
          onlineStore:  this.onlineStore,
          onError:      this.get('onError')
        }).process();
      },

      /**
       * Finds a record both offline and online, returning the first to be found.
       * If an online record is found, it is then pushed into the offline store,
       * which should automatically update the references to the original record
       * (if this was changed).
       *
       * Use this just like regular store's `find()`.
       *
       * @method find
       * @param {string} type
       * @param {object} query
       * @return {Promise}
       */
      find: function(type, query) {
        var _this = this;
        var syncQuery = Query.create({
          onlineStore:  this.onlineStore,
          offlineStore: this.offlineStore,
          onError:      this.get('onError'),
          onRecordAdded: function(record) {
            _this.onRecordAdded(record, type);
          }
        });
        return syncQuery.find(type, query);
      },

      /**
       * Queries both online and offline stores simultaneously, returning values
       * asynchronously into a stream of results (Ember.A()).
       *
       * The records found online are stored into the offline store.
       *
       * Use this just like regular store's `findQuery()`. Remember, though, it
       * doesn't return a Promise, but you can use `.then()` even so.
       *
       * @method findQuery
       * @param {string} type
       * @param {object} query
       * @return {Ember.A}
       */
      findQuery: function(type, query) {
        var _this = this;
        var syncQuery = Query.create({
          onlineStore:  this.onlineStore,
          offlineStore: this.offlineStore,
          onError:      this.get('onError'),
          onRecordAdded:     function(record) {
            _this.onRecordAdded(record, type);
          }
        });
        return syncQuery.findQuery(type, query);
      },

      createRecord: function(type, properties) {
        var _this = this,
            record;

        if (properties) {
          record = this.offlineStore.createRecord(type, properties);
        } else {
          record = this.offlineStore.createRecord(type);
        }

        this.embedThisIntoRecord(record, type, properties);
        return record;
      },

      deleteRecord: function(type, record) {
        record.deleteRecord();
        this.embedThisIntoRecord(record, type);
        return record;
      },

      embedThisIntoRecord: function(record, type, properties) {
        var _this = this;

        record.emberSync = Ember.Object.create({
          init: function() {
            this.set('emberSync',  _this);
            this.set('record',     record);
            this.set('recordType', type);
          },

          save: function() {
            var persistence = Persistence.create({
              onlineStore:  this.get('emberSync.onlineStore'),
              offlineStore: this.get('emberSync.offlineStore'),
              onError:      _this.get('onError')
            });

            return persistence.save(this.get('record'));
          }
        });
      }
    });
  });
;define("ember-sync/store-initialization-mixin", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Mixin.create({
      init: function() {
        this._super();
        // FIXME remove this
        var onlineStore  = this.onlineStore,
            offlineStore = this.offlineStore;

        if (this.container) {
          this.set('container', this.container);

          if (!onlineStore)
            onlineStore = this.container.onlineStore;

          if (!offlineStore)
            offlineStore = this.container.store;
        }

        this.set('offlineStore', offlineStore);
        this.set('onlineStore',  onlineStore);
      },

      container: null,
      offlineStore: null,
      onlineStore: null,
    });
  });
;define("ember-sync/queue", 
  ["ember-sync/store-initialization-mixin","ember-sync/job","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];
    var Job = __dependency2__["default"];

    var queueTimer = null,
        testing = window.TEST,
        supressConsoleErrors = true,
        forceSyncFailure = false;

    __exports__["default"] = Ember.Object.extend(
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

        job = this.offlineStore.createRecord(this.offlineStore.modelFor('emberSyncQueueModel'), {
          jobRecordType: type,
          operation:     operation,
          createdAt:     (new Date).toUTCString(),
          serialized:    properties
        });
        adapter = this.offlineStore.adapterFor(type);
        adapter.createRecord(this.offlineStore, this.offlineStore.modelFor('emberSyncQueueModel'), job);
        job.deleteRecord();
      },

      pendingJobs: null,

      process: function() {
        var _this = this,
            jobs;

        Em.run.cancel(queueTimer);

        jobs = this.offlineStore.find(this.offlineStore.modelFor('emberSyncQueueModel'));
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

        job = Job.create({
          offlineStore: this.offlineStore,
          onlineStore:  this.onlineStore,
          jobRecord:    jobRecord
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
    });
  });
;define("ember-sync/job", 
  ["ember-sync/store-initialization-mixin","ember-sync/record-for-synchronization","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];
    var RecordForSynchronization = __dependency2__["default"];

    __exports__["default"] = Ember.Object.extend(
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
            debugger;
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
  });
;define("ember-sync/record-for-synchronization", 
  ["ember-sync/store-initialization-mixin","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];

    __exports__["default"] = Ember.Object.extend(
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
  });
;define("ember-sync/query", 
  ["ember-sync/store-initialization-mixin","ember-sync/persistence","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];
    var Persistence = __dependency2__["default"];

    __exports__["default"] = Ember.Object.extend(
      StoreInitMixin, {

      onRecordAdded: function() { },

      /**
       * Finds a record both offline and online, returning the first to be found.
       * If an online record is found, it is then pushed into the offline store,
       * which should automatically update the references to the original record
       * (if this was changed).
       *
       * Use this just like regular store's `find()`.
       *
       * @method find
       * @param {string} type
       * @param {object} query
       * @return {Promise}
       */
      find: function(type, query) {
        var _this = this, offlineSearch, onlineSearch;

        if(!Ember.isNone(query)) {
          offlineSearch = this.offlineStore.find(type, query),
          onlineSearch  = this.onlineStore.find(type, query);
        } else {
          offlineSearch = this.offlineStore.find(type),
          onlineSearch  = this.onlineStore.find(type);
        }

        /**
         * In case query is empty, it means find() should return an Array.
         */
        if (!query) {
          return this.findStream(type, offlineSearch, onlineSearch);
        }

        return new Ember.RSVP.Promise(function(resolve, reject) {
          var isResolved = false,
              offlineNotFound, onlineNotFound;

          offlineSearch.then(function(record) {
            if (record.get('id') && !isResolved) {
              _this.onRecordAdded(record);
              resolve(record);
              isResolved = true;
            }
          }, function(error) {
            offlineNotFound = true;
            if (offlineNotFound && onlineNotFound) { reject(error); }
          });

          onlineSearch.then(function(record) {
            var id = record.get('id'),
                persistenceState = _this.offlineStore.find(type, id);

            var persistRecordOffline = function(onlineRecord) {
              var persistence = Persistence.create({
                onlineStore:  _this.onlineStore,
                offlineStore: _this.offlineStore,
              });
              persistence.persistRecordOffline(type, record);
            };

            persistenceState.then(persistRecordOffline, persistRecordOffline);
            if (!isResolved) {
              _this.onRecordAdded(record);
              resolve(record);
              isResolved = true;
            }
          }, function(error) {
            _this.get('onError');
            onlineNotFound = true;
            if (offlineNotFound && onlineNotFound) { reject(error); }
          });
        });
      },

      /**
       * Queries both online and offline stores simultaneously, returning values
       * asynchronously into a stream of results (Ember.A()).
       *
       * The records found online are stored into the offline store.
       *
       * Use this just like regular store's `findQuery()`. Remember, though, it
       * doesn't return a Promise, but you can use `.then()` even so.
       *
       * @method findQuery
       * @param {string} type
       * @param {object} query
       * @return {Ember.A}
       */
      findQuery: function(type, query) {
        var offlineSearch = this.offlineStore.findQuery(type, query),
            onlineSearch  = this.onlineStore.findQuery(type, query);

        return this.findStream(type, offlineSearch, onlineSearch);
      },

      /**
       * PRIVATE
       */

      /**
       * Queries both online and offline stores simultaneously, returning values
       * asynchronously into a stream of results (Ember.A()).
       *
       * The records found online are stored into the offline store.
       *
       * Use this just like regular store's `findQuery()`. Remember, though, it
       * doesn't return a Promise, but you can use `.then()` even so.
       *
       * @method findQuery
       * @param {string} type
       * @param {object} query
       * @return {Ember.A}
       */
      findStream: function(type, offlinePromise, onlinePromise) {
        var _this = this,
            resultStream = Ember.A();

        offlinePromise.then(function(results) {
          results = _this.toArray(results);
          _this.addResultToResultStream(resultStream, results);
        });

        onlinePromise.then(function(results) {
          results = _this.toArray(results);
          _this.addResultToResultStream(resultStream, results);

          results.forEach(function(onlineResult) {
            var id = onlineResult.get('id'),
                persistenceState = _this.offlineStore.find(type, id);

            var persistRecordOffline = function(onlineRecord) {
              var persistence = Persistence.create({
                onlineStore:  _this.onlineStore,
                offlineStore: _this.offlineStore,
              });
              persistence.persistRecordOffline(type, onlineResult);
            };

            persistenceState.then(persistRecordOffline, persistRecordOffline);
          });
        }, function(error) {
          _this.get('onError')
        });

        return resultStream;
      },

      /**
       * Takes an array of the latest results and pushes into the result Stream.
       * This takes into account existing record.
       *
       * @method addResultToResultStream
       * @param {string} type
       * @param {DS.Model} record
       */
      addResultToResultStream: function(resultStream, results) {
        var _this = this;
        if (results.get('length')) {
          results.forEach(function(record) {
            var id = record.get('id'),
                duplicatedId = resultStream.mapBy("id").contains(id);

            if (id && (!resultStream.length || !duplicatedId)) {
              _this.onRecordAdded(record);
              resultStream.pushObject(record);
            }
          });
        }
      },

      toArray: function(objectOrArray) {
        if (objectOrArray.get('id') && !objectOrArray.length) {
          objectOrArray = Ember.A([objectOrArray]);
        }
        return objectOrArray;
      }
    });
  });
;define("ember-sync/persistence", 
  ["ember-sync/store-initialization-mixin","ember-sync/record-for-synchronization","ember-sync/queue","ember-sync/store/record","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var StoreInitMixin = __dependency1__["default"];
    var RecordForSynchronization = __dependency2__["default"];
    var Queue = __dependency3__["default"];
    var StoreRecord = __dependency4__["default"];

    __exports__["default"] = Ember.Object.extend(
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
          var onlineRecord, job, queue;

          properties = offlineRecord.serialize({includeId: true});

          queue = Queue.create({
            onlineStore:  _this.onlineStore,
            offlineStore: _this.offlineStore
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
      persistRecordOffline: function(type, record) {
        var offlineSerializer = this.offlineStore.serializerFor(type),
            snapshot = record._createSnapshot(),
            serialized = offlineSerializer.serialize(snapshot, { includeId: true }),
            recordForSynchronization;

        recordForSynchronization = StoreRecord.create({
          store: this.offlineStore,
          snapshot: snapshot
        }).pushableCollection();

        for (var typeKey in recordForSynchronization) {
          if (!recordForSynchronization.hasOwnProperty(typeKey)) {
            continue;
          }

          for (var index in recordForSynchronization[typeKey]) {
            if (!recordForSynchronization[typeKey].hasOwnProperty(index)) {
              continue;
            }

            var serialized = recordForSynchronization[typeKey][index],
                record,
                model;

            record = RecordForSynchronization.create({
              offlineStore: this.offlineStore
            });
            record.setDateObjectsInsteadOfDateString(typeKey, serialized);

            model = this.offlineStore.push(typeKey, serialized);
            model.save();
          }
        }
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
  });
;define("ember-sync/store/record", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = Ember.Object.extend({
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
  });
;define("ember-sync/ember-sync-queue-model", 
  ["exports"],
  function(__exports__) {
    "use strict";
    __exports__["default"] = DS.Model.extend({
      jobRecordType: DS.attr('string'),
      serialized:    DS.attr(),
      operation:     DS.attr('string'),
      createdAt:     DS.attr('string'),
    });
  });