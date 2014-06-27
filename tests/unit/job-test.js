var EmberSyncQueueModel = require('lib/ember-sync/ember-sync-queue-model').default;
var EmberSyncJob = require('lib/ember-sync/job').default;

var env = {}, emberSync, subject,
    jobRecord, jobRecordModel,
    cart, customer, cartItem,
    offlineStore, onlineStore,
    container;

module("Unit - Lib/EmberSync/Job", {
  setup: function() {
    Em.run(function() {
      cart = DS.Model.extend({
        total:     DS.attr('string'),
        cartItems: DS.hasMany('cartItem'),
        customer:  DS.belongsTo('customer'),
      });

      customer = DS.Model.extend({
        name: DS.attr('number'),
        cart: DS.belongsTo('cart'),
      });

      cartItem = DS.Model.extend({
        price: DS.attr('number'),
        cart:  DS.belongsTo('cart'),
      });

      env = setupOfflineOnlineStore({
        cart: cart,
        cartItem: cartItem,
        customer: customer,
        emberSyncQueueModel: EmberSyncQueueModel
      });

      offlineStore = env.store;
      onlineStore = env.onlineStore;

      /**
       * Sets up the models, queue and jobs
       */
      cart = offlineStore.createRecord('cart', { id: 12, total: "10" });

      jobRecordModel = offlineStore.createRecord('emberSyncQueueModel', {
        jobRecordType: "cart",
        serialized:    cart.serialize({includeId: true}),
        operation:     "create",
        createdAt:     (new Date).toUTCString()
      });

      /**
       * TODO - why are we passing this around instead of the model?
       */
      // FIXME not needed given the tests are using their own records
      jobRecord = Ember.Object.create({
        id:            jobRecordModel.get('id'),
        jobRecordType: jobRecordModel.get('jobRecordType'),
        serialized:    jobRecordModel.get('serialized'),
        operation:     jobRecordModel.get('operation')
      });

      subject = EmberSyncJob.create({
        offlineStore:    offlineStore,
        onlineStore:     onlineStore,
        jobRecord:       jobRecord
      });
    });
  },

  tearDown: function() {
    EmberSync.testing = true;
  }
});

test("#deletion unloads previous record and recreates it", function() {
  var result;
  stop();

  Em.run(function() {
    jobRecord = Ember.Object.create({
      id:            jobRecordModel.get('id'),
      jobRecordType: jobRecordModel.get('jobRecordType'),
      serialized:    jobRecordModel.get('serialized'),
      operation:     'delete'
    });

    subject = EmberSyncJob.create({
      offlineStore:    offlineStore,
      onlineStore:     onlineStore,
      jobRecord:       jobRecord
    });

    subject.deletion().then(function(deleted) {
      equal(deleted.id, cart.id,   "Record has same id");
      equal(deleted.get('isNew'),   false, "Record is new (so we use POST)");
      equal(deleted.get('isDirty'), true, "Record isDirty");
      equal(deleted.get('currentState.stateName'), "root.deleted.uncommitted", "Record is deleted but uncommitted");

      subject.deletion().then(function(deleted) {
        equal(deleted.id, cart.id,   "Record has same id");
        equal(deleted.get('isNew'),   false, "Record is new (so we use POST)");
        equal(deleted.get('isDirty'), true, "Record isDirty");
        equal(deleted.get('currentState.stateName'), "root.deleted.uncommitted", "Record is deleted but uncommitted");
        start();
      });
    });
  });
});
