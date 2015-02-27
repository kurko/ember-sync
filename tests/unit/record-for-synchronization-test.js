var EmberSyncQueueModel = require('lib/ember-sync/ember-sync-queue-model').default;
var RecordForSynchronization = require('lib/ember-sync/record-for-synchronization').default;

var env = {}, emberSync, subject,
    onlineResults, jobRecord, jobRecordModel,
    cart,
    offlineStore, onlineStore,
    createdAt = new Date,
    createdAtAsString = "Thu, 06 Feb 2014 03:02:02 GMT",
    container;

module("Unit - Lib/EmberSync/RecordForSynchronization", {
  setup: function() {
    Em.run(function() {
      cart = DS.Model.extend({
        total:     DS.attr('string'),
        createdAt: DS.attr('date', {
          default: function() { return new Date(); }
        }),
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

      EmberSync.testing = true;

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
      cart = offlineStore.createRecord('cart', {
        total: "10",
        createdAt: createdAt
      });
      jobRecordModel = offlineStore.createRecord('emberSyncQueueModel', {
        jobRecordType: "cart",
        serialized:    cart.serialize({includeId: true}),
        operation:     "create",
        createdAt:     (new Date).toUTCString()
      });

      /**
       * TODO - why are we passing this around instead of the model?
       */
      jobRecord = Ember.Object.create({
        id:            jobRecordModel.get('id'),
        jobRecordType: jobRecordModel.get('jobRecordType'),
        serialized:    jobRecordModel.get('serialized'),
        operation:     jobRecordModel.get('operation')
      });

      subject = function(customCart) {
        if (!customCart) {
          customCart = cart;
        }
        return RecordForSynchronization.create({
          offlineStore:    offlineStore,
          onlineStore:     onlineStore,
          offlineRecord:   customCart,
          jobRecord:       jobRecord
        });
      };
    });
  },

  tearDown: function() {
    EmberSync.testing = true;
  }
});

test("#createRecordInStore creates a new record in store for operation=create", function() {
  var result;
  stop();

  Em.run(function() {
    result = subject().createRecordInStore();

    equal(result.id, cart.id, "Record has same id");
    equal(result.get('total'), "10", "Record has correct total");
    equal(result.get('isNew'), true, "Record isNew");
    equal(result.get('isDirty'), true, "Record isDirty");
    start();
  });
});

test("#createRecordInStore pushes record when operation=update", function() {
  var result;
  stop();

  Em.run(function() {
    jobRecord.set("operation", "update");

    subject = RecordForSynchronization.create({
      offlineStore:    offlineStore,
      onlineStore:     onlineStore,
      offlineRecord:   offlineStore.createRecord('cart', { total: "10" }),
      jobRecord:       jobRecord
    });

    result = subject.createRecordInStore();

    equal(result.id, cart.id, "Record has same id");
    equal(result.get('total'), "10", "Record has correct total");
    equal(result.get('isNew'), false, "Record is not new (so we use PUT)");
    equal(result.get('isDirty'), false, "Record isDirty");
    start();
  });
});

test("#createRecordInStore unloads previous record and recreates it with operation=create", function() {
  var result;
  stop();

  Em.run(function() {
    subject().createRecordInStore();

    result = subject().createRecordInStore();
    equal(result.id, cart.id,    "Record has same id");
    equal(result.get('total'),   "10", "Record has correct total");
    equal(result.get('isNew'),   true, "Record is new (so we use POST)");
    equal(result.get('isDirty'), true, "Record isDirty");
    start();
  });
});

test("#createRecordInStore returns record that serialize dates", function() {
  var result, serialized, date;

  now = new Date(Date.parse("Thu, 06 Feb 2014 04:49:57 GMT"));
  stop();

  Em.run(function() {
    cart = offlineStore.createRecord('cart', {
      total: "10",
      createdAt: now
    });
    jobRecordModel = offlineStore.createRecord('emberSyncQueueModel', {
      jobRecordType: "cart",
      serialized: {
        id: cart.id,
        total: "10",
        createdAt: "Thu, 06 Feb 2014 04:49:57 GMT",
        customer: null
      },
      operation: "create",
      createdAt: (new Date).toUTCString()
    });

    /**
     * TODO - why are we passing this around instead of the model?
     */
    jobRecord = Ember.Object.create({
      id:            jobRecordModel.get('id'),
      jobRecordType: jobRecordModel.get('jobRecordType'),
      serialized:    jobRecordModel.get('serialized'),
      operation:     jobRecordModel.get('operation')
    });

    result = subject(cart).createRecordInStore();
    equal(result.get('total'),   "10", "Record has correct total");

    // TODO - make this test pass across timezone
    // equal(result.get('createdAt'), "Thu Feb 06 2014 02:49:57 GMT-0200 (BRST)", "Record has createdAt with correct value");

    serialized = result.serialize();
    equal(serialized.createdAt, "2014-02-06T04:49:57.000Z", "Serialized record has createdAt");

    start();
  });
});

test("#setRelationships sets the belongsTo relationships", function() {
  var onlineCart, customer;
  stop();

  Em.run(function() {
    customer = offlineStore.createRecord('customer', {
      firstName: "John", lastName: "Rambo"
    });
    cart.set('customer', customer);

    equal(cart.get('customer.firstName'), "John", "Customer is set into cart");

    onlineCart = onlineStore.createRecord('cart', { total: "10" });
    ok(!onlineCart.get('customer'), "Newly generated cart has no customer");

    onlineCart = subject().setRelationships(onlineCart);
    var customerId = customer.get('id');

    ok(onlineCart.get('customer'), "Cart has now a customer");
    equal(onlineCart.get("customer.id"), customerId, "Customer has correct id");

    start();
  });
});

test("#setRelationships sets the hasMany relationships", function() {
  var cartItem;
  stop();

  Em.run(function() {
    cartItem = offlineStore.createRecord('cartItem', {
      price: 10,
      inventoryEntryId: 2
    });
    var originalCartItemId = cartItem.get('id');
    cart.get('cartItems').pushObject(cartItem);

    equal(cart.get('cartItems').objectAt(0).get('price'), 10, "CartItem has price");

    var newCart = onlineStore.createRecord('cart', { total: "10" });
    ok(!newCart.get('cartItems.length'), "Newly generated cart has no cart items");

    cart = subject().setRelationships(newCart);
    var cartItems = cart.get('cartItems'),
        cartItem  = cartItems.objectAt(0);

    ok(cartItems.get('length'), "Cart has now an item");
    equal(cartItem.get("id"), originalCartItemId, "Item has correct id");
    equal(cartItem.get("price"), 10, "Item has correct price");

    start();
  });
});

test("#propertiesToPersist returns only attributes", function() {
  var result, expected;
  stop();

  Em.run(function() {
    expected = {
      id: cart.get('id'),
      total: "10",
      createdAt: createdAt
    };

    result = subject().propertiesToPersist(cart);


    equal(typeof result.createdAt, "object", "Dates are objects");
    equal(result.createdAt.toString(), expected.createdAt.toString(), "Dates are correct");
    delete result.createdAt;
    delete expected.createdAt;
    deepEqual(result, expected, "Properties are correct");
    start();
  });
});
