/**
 * In the app, there are 2 stores, one for offline and another
 * for online connection.
 *
 * This is the store and adapter used to simulate online connection under
 * tests using QUNIT.
 */
var registeredNameForOnlineAdapter = "_online_adapter";

var onlineSerializer = DS.LSSerializer.extend();
var onlineAdapter = DS.LSAdapter.extend({
  namespace: 'onlineStore'
});

DS.OnlineStore = DS.Store.extend({
  defaultAdapter: onlineAdapter,

  adapterFor: function(type) {
    return this.container.lookup('adapter:' + registeredNameForOnlineAdapter);
  },

  serializerFor: function(type) {
    return this.container.lookup('serializer:' + registeredNameForOnlineAdapter);
  }
});

var optionsForOnlineStore = {
  store: DS.OnlineStore,
  registeredName: registeredNameForOnlineAdapter,
  adapter: onlineAdapter,
  serializer: onlineSerializer
}

/**
 * Registers the store within Ember application
 */
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "onlineStore",

    initialize: function(container, application) {
      registerOnlineStoreIntoContainer(container, optionsForOnlineStore);
      injectOnlineStoreIntoApplication(container, application);
    }
  });
});
