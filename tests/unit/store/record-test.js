var StoreRecord = require('lib/ember-sync/store/record').default;

var env = {}, subject,
    Cart, Customer, CartItem,
    cart, customer, cartItem,
    offlineStore, onlineStore,
    createdAt = new Date("Thu, 06 Feb 2014 03:02:02 GMT"),
    createdAtAsString = "2014-02-06T03:02:02.000Z";

module("Unit - Lib/EmberSync/Store/Record", {
  setup: function() {
    Em.run(function() {
      resetLocalStorage('offline');
      resetLocalStorage('online');

      Cart = DS.Model.extend({
        total:     DS.attr('string'),
        createdAt: DS.attr('date', {
          default: function() { return new Date(); }
        }),
        cartItems: DS.hasMany('cartItem'),
        customer:  DS.belongsTo('customer'),
      });

      Customer = DS.Model.extend({
        name: DS.attr('string'),
        cart: DS.belongsTo('cart'),
      });

      CartItem = DS.Model.extend({
        price: DS.attr('number'),
        cart:  DS.belongsTo('cart'),
      });

      EmberSync.testing = true;

      env = setupOfflineOnlineStore({
        cart: Cart,
        cartItem: CartItem,
        customer: Customer
      });

      offlineStore = env.store;
      onlineStore = env.onlineStore;

      offlineStore.unloadAll('customer');
      offlineStore.unloadAll('cart');
      offlineStore.unloadAll('cartItem');
      onlineStore.unloadAll('customer');
      onlineStore.unloadAll('cart');
      onlineStore.unloadAll('cartItem');

      customer = offlineStore.createRecord('customer', {id: 11, name: "Alex"});
      cartItem = offlineStore.createRecord('cartItem', {id: 12, price: 12});
      cart = offlineStore.createRecord('cart', {
        id: 13,
        total: "10",
        createdAt: createdAt
      });
      cart.set('customer', customer)
      cart.get('cartItems').pushObject(cartItem);

      subject = function() {
        return StoreRecord.create({
          store: offlineStore,
          snapshot: cart._createSnapshot()
        });
      };
    });
  },

  tearDown: function() {
    EmberSync.testing = false;
  }
});

test("#pushableCollection returns serialized object", function() {
  expect(6);

  collection = subject().pushableCollection();

  equal(collection.cart[0].total, cart.get('total'), 'total is good');
  equal(collection.cart[0].createdAt, createdAtAsString, 'total is good');
  equal(collection.customer[0].name, 'Alex', 'customer name is good');
  equal(collection.customer[0].cart, 13, 'customer cart is good');
  equal(collection.cartItem[0].price, 12, 'item price is good');
  equal(collection.cartItem[0].cart,  13, 'item cart is good');
});
