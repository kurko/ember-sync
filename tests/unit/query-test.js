var EmberSyncQuery = require('lib/ember-sync/query').default;

var subject,
    env,
    offlineStore,
    onlineStore;

var onRecordCalled = 0;
var onRecordAdded = function() {
  onRecordCalled++;
};

module("Unit - Lib/EmberSync/Query", {
  setup: function() {
    var cart;

    Em.run(function() {
      cart = DS.Model.extend({
        total: DS.attr('string')
      });

      env = setupOfflineOnlineStore({
        cart: cart,
        emberSyncQueueModel: EmberSyncQueueModel,
        adapter: DS.LSAdapter
      });

      offlineStore = env.store;
      onlineStore  = env.onlineStore;

      subject = EmberSyncQuery.create({
        onlineStore:    onlineStore,
        offlineStore:   offlineStore,
        onError:        function() {},
        onRecordAdded:  onRecordAdded
      });
    });
  }
});

test("#onRecordAdded gets called for each record added", function() {
  onRecordCalled = 0;
  stop();

  Em.run(function() {
    cart1 = offlineStore.createRecord('cart');
    cart2 = offlineStore.createRecord('cart');
    cart3 = offlineStore.createRecord('cart');
    var carts = [cart1, cart2, cart3];
    var stream = [];

    subject.addResultToResultStream([], carts);

    deepEqual(onRecordCalled, 3, "onRecordAdded called 3 times");
    start();
  });
});
