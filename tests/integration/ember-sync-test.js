var EmberSyncQueueModel = require('lib/ember-sync/ember-sync-queue-model').default;
var EmberSync = require(["lib/ember-sync"]).default;

var env = {}, emberSync,
    onlineResults,
    offlineStore, onlineStore,
    container;

module("Integration/Lib/EmberSync", {
  setup: function() {
    resetLocalStorage();

    var InventoryItem = DS.Model.extend({
      name:           DS.attr('string'),
      description:    DS.attr('string'),
      price:          DS.attr('string'),
      entryForSaleId: DS.attr('string'),
      onSale:         DS.attr('boolean')
    });

    var CashEntry = DS.Model.extend({
      amount:      DS.attr('number'),
      description: DS.attr('string'),
      createdAt:   DS.attr('date')
    });

    env = setupOfflineOnlineStore({
      inventoryItem: InventoryItem,
      cashEntry: CashEntry,
      emberSyncQueueModel: EmberSyncQueueModel
    });

    offlineStore = env.store;
    onlineStore = env.onlineStore;

    emberSync = EmberSync.create({ container: env });
  }
});

var Synchronize = function(record) {
  ok(true, "Synchronizing");
  return new Ember.RSVP.Promise(function(resolve, reject) {
    Em.run.later(function() { emberSync.synchronizeOnline(); }, 5);
    Em.run.later(function() { resolve(); }, 70);
  });
}

var StartQunit = function() { start(); }

var assertItemDoesntExistOffline = function(type, id) {
  var assertMessage = "No item exists offline for id "+id,
      queryFunction = (!!parseInt(id) ? 'find' : 'findQuery');

  return offlineStore[queryFunction](type, id).then(function(item) {
    console.error("Record for "+type+" should be in the offline store");
    ok(false, assertMessage);
    return Ember.RSVP.resolve();
  }, function() {
    ok(true, assertMessage);

    return Ember.RSVP.resolve();
  });
}

var assertItemExistsOffline = function(type, id) {
  var assertMessage = ""+type+" record was found for id "+id,
      queryFunction = (!!parseInt(id) ? 'find' : 'findQuery');

  return offlineStore[queryFunction](type, id).then(function(item) {
    ok(true, assertMessage);
    return Ember.RSVP.resolve();
  }, function() {
    ok(false, assertMessage);
    return Ember.RSVP.resolve();
  });
}

test("#createRecord creates a new record instance", function() {
  var record, prop;

  Em.run(function() {
    prop = {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    };
    record = emberSync.createRecord('inventoryItem', prop);

    equal(record.get('name'), 'Fender', 'name is correct');
    equal(record.get('description'), 'Super guitar', 'description is correct');
    equal(record.get('price'), '123', 'price is correct');
    equal(record.get('entryForSaleId'), '1', 'entryForSaleId is correct');
    equal(record.get('onSale'), true, 'onSale is correct');

    var originalRecord    = record.emberSync.get('record'),
        emberSyncInstance = record.emberSync.get('emberSync'),
        recordType        = record.emberSync.get('recordType'),
        recordProperties  = record.emberSync.get('recordProperties');

    equal(record,            originalRecord,  'emberSync.record is correct');
    equal(recordType,        'inventoryItem', 'emberSync.recordType is correct');
    equal(emberSyncInstance, emberSync,       'emberSync instance is correct');
  });
});

test("#save - creates a record offline and online", function() {
  var record, offlineSave, generatedId;
  stop();

  Em.run(function() {
    record = emberSync.createRecord('inventoryItem', {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });

    generatedId = record.get('id');
    ok(generatedId, "ID is valid ("+generatedId+")");

    offlineSave = record.emberSync.save();
    offlineSave.then(function(record) {
      ok(true, "Record saved offline");
      equal(record.get('id'),             generatedId,    "id is correct");
      equal(record.get('name'),           "Fender",       "name is correct");
      equal(record.get('description'),    "Super guitar", "description is correct");
      equal(record.get('price'),          "123",          "price is correct");
      equal(record.get('entryForSaleId'), "1",            "entryForSaleId is correct");
      equal(record.get('onSale'),         true,           "onSale is correct");

      Em.run.later(function() {
        emberSync.synchronizeOnline();
      }, 5);

      Em.run.later(function() {
        var record = getModelLS('online', 'inventoryItem', generatedId);

        ok(true, "Record saved online");
        equal(record.id,             generatedId,    "id is correct");
        equal(record.name,           "Fender",       "name is correct");
        equal(record.description,    "Super guitar", "description is correct");
        equal(record.price,          "123",          "price is correct");
        equal(record.entryForSaleId, "1",            "entryForSaleId is correct");
        equal(record.onSale,         true,           "onSale is correct");
        start();
      }, 30);

    }, function() {
      ok(false, "Record saved offline");
      start();
    });
  });
});

test("#find - searches offline/online simultaneously, syncing online into offline and returning a stream of data", function() {

  onlineStore.push('cashEntry', {
    id: 1,
    amount: '120',
    description: 'First entry',
    createdAt: myDate()
  });

  stop();

  Em.run(function() {

    assertItemDoesntExistOffline('cashEntry', 1).then(function() {
      return emberSync.find('cashEntry', 1);
    }).then(function(item) {
      Em.run.later(function() {
        equal(item.get('description'), "First entry", "Data from store online");
        ok(item.get('createdAt'), "createdAt is present online");
      }, 70);

      Em.run.later(function() {
        offlineStore.find('cashEntry', 1).then(function(item) {

          ok(true, "Item was added to the offline store");
          equal(item.get('id'), 1, "New offline item has a correct id");
          equal(item.get('description'), "First entry", "New offline item has a correct name");
          ok(item.get('createdAt'), "createdAt is present offline");
          equal(item.get('createdAt').getDate(), (new Date).getDate(), "Offline date is correct");
          start();
        }, function() {
          console.log("Item was not added to the offline store");
          ok(false, "Item was added to the offline store");
        });
      }, 70);
    });
  });
});

test("#findQuery searches offline/online simultaneously, syncing online into offline and returning a stream of data", function() {
  var item, duplicatedItem, fixture;

  fixture = JSON.stringify({
    inventoryItem: {
      records: {
        2: {
          id: '2',
          name: "Fender",
          description: "Fender 1",
          price: 200.0,
          entry_for_sale_id: 2,
          on_sale: true
        }
      }
    }
  });
  localStorage.setItem('onlineStore', fixture);

  expect(14);
  stop();

  Em.run(function() {
    assertItemDoesntExistOffline('inventoryItem', {name: "Fender"}).then(function() {
      item = offlineStore.createRecord('inventoryItem', {
        id: 3,
        name: "Fender",
        description: "Fender 2",
        price: 200.0,
        entry_for_sale_id: 2,
        on_sale: true
      });

      duplicatedItem = offlineStore.createRecord('inventoryItem', {
        id: 4,
        name: "Fender",
        description: "Fender 3 from offline",
        price: 300.0,
        entry_for_sale_id: 2,
        on_sale: true
      });

      return Ember.RSVP.all([item.save(), duplicatedItem.save()]);
    }).then(function(item) {
      return assertItemExistsOffline('inventoryItem', {name: "Fender"});
    }).then(function() {
      return emberSync.findQuery('inventoryItem', {name: "Fender"});
    }).then(function(items) {
      equal(items.length, 0, "At first, an empty array of results is returned");

      Em.run.later(function() {
        equal(items.get('length'), 3, "Offline record is added asynchronously");
        var firstItem, secondItem, thirdItem;

        firstItem = items.objectAt(1);
        equal(firstItem.get('id'),   3,        "Offline item id is correct");
        equal(firstItem.get('name'), "Fender", "Offline item name is correct");
        equal(firstItem.get('description'), "Fender 2", "Offline item description is correct");

        secondItem = items.objectAt(2);
        equal(secondItem.get('id'),   4,        "Offline item id is correct");
        equal(secondItem.get('name'), "Fender", "Offline item name is correct");
        equal(secondItem.get('description'), "Fender 3 from offline", "Offline item description is correct");
        equal(items.get('length'), 3, "Second online record is magically added to the result stream asynchronously");

        thirdItem = items.objectAt(0);
        equal(thirdItem.get('id'),   2,        "Online item id is correct");
        equal(thirdItem.get('name'), "Fender", "Online item name is correct");
        equal(thirdItem.get('description'), "Fender 1", "Online item description is correct");
        start();
      }, 20);
    });
  });
});

test("#save - creates a record offline and enqueues online sync", function() {
  var oldRecord, newRecord, offlineSave, generatedId,
      serializedOldRecord, serializedUpdatedRecord, serializedNextRecord;

  stop();

  Em.run(function() {
    var record = emberSync.createRecord('inventoryItem', {
      name: "Old Fender 1",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });
    serializedOldRecord = record.serialize({includeId: true});

    return record.emberSync.save();
  }).then(function(oldRecord) {
    oldRecord.set('name', 'Old Fender 2');
    serializedUpdatedRecord = oldRecord.serialize({includeId: true});

    return oldRecord.emberSync.save();
  }).then(function(oldRecord) {
    ok(oldRecord.get('id'), "Record has a valid ID");

    newRecord = emberSync.createRecord('inventoryItem', {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });

    serializedNextRecord = newRecord.serialize({includeId: true});
    newRecordId = newRecord.get('id');
    ok(newRecordId, "ID is valid ("+newRecordId+")");

    offlineSave = newRecord.emberSync.save();
    offlineSave.then(function(newRecord) {
      ok(true, "Record saved offline");
      equal(newRecord.get('id'),             newRecordId,    "id is correct ("+newRecordId+")");
      equal(newRecord.get('name'),           "Fender",       "name is correct");
      equal(newRecord.get('description'),    "Super guitar", "description is correct");
      equal(newRecord.get('price'),          "123",          "price is correct");
      equal(newRecord.get('entryForSaleId'), "1",            "entryForSaleId is correct");
      equal(newRecord.get('onSale'),         true,           "onSale is correct");

      Ember.run.later(function() {
        var jobs = offlineStore.find('emberSyncQueueModel');

        jobs.then(function(jobs) {
          equal(jobs.get('length'), 3, "One synchronization job is created");

          var creationJob  = jobs.objectAt(0),
              updateJob    = jobs.objectAt(1),
              creationJob2 = jobs.objectAt(2),

              job1Date = Date.parse(creationJob.get('createdAt')),
              job2Date = Date.parse(updateJob.get('createdAt')),
              job3Date = Date.parse(creationJob2.get('createdAt'));

          /**
           * First job to create the record
           */
          equal(creationJob.get('serialized.id'), oldRecord.id,    "creation job's record id is correct");
          equal(creationJob.get('jobRecordType'), 'inventoryItem', "creation job's record type is correct");
          equal(creationJob.get('operation'),     "create",        "creation job's operation is create");
          ok(creationJob.get('createdAt'),                         "creation job's date is correct");
          deepEqual(creationJob.get('serialized'), serializedOldRecord, "creation job's properties are persisted");

          /**
           * Second job to update the record
           */
          equal(updateJob.get('serialized.id'), oldRecord.id,    "update job's record id is correct");
          equal(updateJob.get('jobRecordType'), 'inventoryItem', "update job's record type is correct");
          equal(updateJob.get('operation'),     "update",        "update job's operation is update");
          ok(updateJob.get('createdAt'),                         "update job's has a date");
          deepEqual(updateJob.get('serialized'), serializedUpdatedRecord, "update job's properties are persisted");

          /**
           * Third job to create a new record
           */
          equal(creationJob2.get('serialized.id'), newRecord.id,    "creation job 2's new record id is correct");
          equal(creationJob2.get('jobRecordType'), 'inventoryItem', "creation job 2's new record type is correct");
          equal(creationJob2.get('operation'),     "create",        "creation job 2's operation is create");
          ok(creationJob2.get('createdAt'),                         "creation job 2's date is correct");
          deepEqual(creationJob2.get('serialized'), serializedNextRecord, "creation job 2's properties are persisted");
          start();
        });
      }, 80);

    }, function() {
      ok(false, "Record saved offline");
      start();
    });
  });
});

test("#save returns the same DS.Model instance that was created", function() {
  stop();

  Em.run(function() {
    var record = emberSync.createRecord('inventoryItem', {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });

    record.emberSync.save().then(function(item) {
      ok(item.emberSync, "Returned record has emberSync method");
      equal(item.emberSync.recordType, "inventoryItem", "Returned record has correct type");
      start();
    });
  });
});

test("#save deletes a record offline and then online if it's marked as so", function() {
  var record, offlineSave, generatedId;
  stop();

  Em.run(function() {
    record = emberSync.createRecord('inventoryItem', {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });

    generatedId = record.get('id');
    ok(generatedId, "ID is valid ("+generatedId+")");

    offlineSave = record.emberSync.save();

    var TestSynchronized = function() {
      ok(getModelLS('online', 'inventoryItem', generatedId));
      return Ember.RSVP.resolve();
    }

    var MarkForDeletion = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        emberSync.deleteRecord('inventoryItem', record);
        record.emberSync.save().then(function() {
          Em.run.later(function() {
            resolve();
          }, 30);
        });
      });
    }

    var TestDeleteJobsAreCreated = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        var jobs = offlineStore.find('emberSyncQueueModel');

        jobs.then(function(jobs) {
          var deletionJob = jobs.objectAt(0);

          equal(jobs.get('length'), 1, "Only deletion job is present");

          equal(deletionJob.get('operation'), 'delete', "Deletion job's operation is delete");
          resolve();
        });
      });
    };

    var TestRecordIsDeleted = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        ok(!getModelLS('online', 'inventoryItem', generatedId));

        equal(offlineStore.recordForId('inventoryItem', generatedId).get('currentState.stateName'), 'root.empty', "Record is deleted from offline DS.Store");
        offlineStore.find('inventoryItem', generatedId).then(
          function() { ok(false, "Record is deleted from offline database"); resolve(); },
          function() { ok(true, "Record is deleted from offline database"); resolve(); }
        );
      });
    }

    offlineSave.then(Synchronize)
               .then(TestSynchronized)
               .then(MarkForDeletion)
               .then(TestDeleteJobsAreCreated)
               .then(Synchronize)
               .then(TestRecordIsDeleted)
               .then(StartQunit)
  });
});

test("#save operates a creation job even if offline record doesn't exist anymore", function() {
  var record, offlineSave, generatedId;
  stop();

  fixture = JSON.stringify({
    inventoryItem: {
      records: {
        1: { id: '1', name: "fender 1" },
        2: { id: '2', name: "fender 2" },
        3: { id: '3', name: "fender 3" }
      }
    }
  });
  localStorage.setItem('onlineStore', fixture);

  Em.run(function() {
    record = emberSync.createRecord('inventoryItem', {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    });

    generatedId = record.get('id');
    ok(generatedId, "ID is valid ("+generatedId+")");
    ok(getModelLS('online', 'inventoryItem', 1), "Record 1 is online");
    ok(getModelLS('online', 'inventoryItem', 2), "Record 2 is online");
    ok(getModelLS('online', 'inventoryItem', 3), "Record 3 is online");

    offlineSave = record.emberSync.save();

    var MarkForDeletion = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        emberSync.deleteRecord('inventoryItem', record);
        record.emberSync.save().then(function() {
          Em.run.later(function() {
            resolve();
          }, 10);
        });
      });
    }

    var TestDeleteJobsAreCreated = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        var jobs = offlineStore.find('emberSyncQueueModel');

        jobs.then(function(jobs) {
          var creationJob = jobs.objectAt(0),
              deletionJob = jobs.objectAt(1);

          equal(jobs.get('length'), 2, "Only deletion job is present");

          equal(creationJob.get('operation'), 'create', "Create job's operation is create");
          equal(deletionJob.get('operation'), 'delete', "Deletion job's operation is delete");
          resolve();
        });
      });
    };

    var TestRecordIsDeleted = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        /**
         * On the timer...
         *
         * Have to wait a bit longer here for the spec to pass. It seems that
         * deleting records takes longer than creating
         */
        Em.run.later(function() {
          //var record = App.InventoryItem.FIXTURES.slice(-1)[0];

          //FIXME
          //ok(!getModelLS('online', 'inventoryItem', generatedId), "Record is deleted online");
          //equal(getModelLS('online', 'inventoryItem'), 3, "There are 3 records online");
          equal(offlineStore.recordForId('inventoryItem', generatedId).get('currentState.stateName'), 'root.empty', "Record is deleted from offline DS.Store");
          offlineStore.find('inventoryItem', generatedId).then(function() {
            ok(false, "Record is deleted from offline database");
            resolve();
          }, function() {
            ok(true, "Record is deleted from offline database");
            resolve();
          });
        }, 80);
      });
    }

    var TestJobsWereDeleted = function() {
      return new Ember.RSVP.Promise(function(resolve, reject) {
        var jobs = offlineStore.find('emberSyncQueueModel');

        jobs.then(function(jobs) {
          equal(jobs.get('length'), 0, "Jobs were run and deleted successfully!");
          resolve();
        });
      });
    }

    offlineSave.then(MarkForDeletion)
               .then(TestDeleteJobsAreCreated)
               .then(Synchronize)
               .then(TestRecordIsDeleted)
               .then(TestJobsWereDeleted)
               .then(StartQunit)
  });
});

test("#deleteRecord delete the record from the store", function() {
  var record, prop;

  stop();
  Em.run(function() {
    prop = {
      name: "Fender",
      description: "Super guitar",
      price: "123",
      entryForSaleId: "1",
      onSale: true
    };
    newRecord = emberSync.createRecord('inventoryItem', prop);

    newRecord.emberSync.save().then(function(record) {
      equal(record.get('name'), 'Fender', 'name is correct');
      equal(record.get('description'), 'Super guitar', 'description is correct');
      equal(record.get('price'), '123', 'price is correct');
      equal(record.get('entryForSaleId'), '1', 'entryForSaleId is correct');
      equal(record.get('onSale'), true, 'onSale is correct');

      record = emberSync.deleteRecord('inventoryItem', record);

      var record            = record.emberSync.get('record'),
          emberSyncInstance = record.emberSync.get('emberSync'),
          recordType        = record.emberSync.get('recordType'),
          recordProperties  = record.emberSync.get('recordProperties');

      equal(record.get('currentState.stateName'), 'root.deleted.uncommitted', 'record is marked for deletion');
      equal(record,            record, 'emberSync.record instance is correct');
      equal(recordType,        'inventoryItem', 'emberSync.recordType is correct');
      equal(emberSyncInstance, emberSync, 'emberSync instance is correct');
      ok(!recordProperties,    'emberSync.recordProperties is not defined');
      start();
    });
  });
});

test("#save works when no properties were given", function() {
  var record, offlineSave, generatedId;
  stop();

  Em.run(function() {

    record = emberSync.createRecord('inventoryItem');

    generatedId = record.id;
    ok(generatedId, "ID is valid ("+generatedId+")");

    offlineSave = record.emberSync.save();
    offlineSave.then(function(record) {
      ok(true, "Record saved offline");
      equal(record.id, generatedId, "id is correct");

      Em.run.later(function() {
        emberSync.synchronizeOnline();
      }, 5);

      Em.run.later(function() {
        ok(getModelLS('online', 'inventoryItem', generatedId), "id is correct");
        start();
      }, 30);

    }, function() {
      ok(false, "Record saved offline");
      start();
    });
  });
});
