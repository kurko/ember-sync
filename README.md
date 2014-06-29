Ember Sync
================================

Ember Sync allows your Ember.js application to seamlessly work online and offline.

**Alpha version:** beware of the risks if you want to try it in production.

### How it works

Ember Sync has a queue of operations. Every time you save, update or delete
a record in your offline database (e.g LocalStorage, IndexedDB etc) as you
usually do, a new operation is created in the queue.

The queue is processed in order and records are synchronized with the online
store (e.g RESTAdapter). This online store is used by Ember Sync and is created
automatically for you.

![Ember Sync](http://f.cl.ly/items/2j113g1q0U1L3v3n0W3t/embersync.png)

Ember Data is required.

### Querying online records

Whenever you search something, Ember Sync will automatically
query concurrently both offline and online stores and merge the results into
a single Ember array.

This means that `findQuery` returns an `Ember.A()` right away instead of a
promise. If 2 seconds later a response comes from the REST api, Ember Sync
will push new records to the array that was already being shown in the
template. This mimics how streams work.

In the process, Ember Sync will automatically update your
offline database with the records that come from the online store.

Usage
-----

For this example, we'll consider
[IndexedDBAdapter](https://github.com/kurko/ember-indexeddb-adapter)
as offline
database and `ActiveModelAdapter` as online one. You can use any databases you
want.

For Ember runtime, we'll use Ember CLI.

### Installation

1. Add `"ember-sync": "^0.1.0"` as a dependency in your `bower.json` file.

2. Add the following to you `Brofile.js` and restart your server:

    ```js
    app.import('vendor/ember-sync/dist/ember-sync.js', { 'ember-sync': [ 'default' ] });
    ```

### Initialization

1. **Define an online store**: to setup Ember Sync you have to define what is
your online store. It can be done in many ways and it's not
related to Ember Sync itself, but here's an example:

    ```js
    // app/initializers/online-store.js
    var CustomOnlineSerializer = DS.ActiveModelSerializer.extend();
    var CustomOnlineAdapter = DS.ActiveModelAdapter.extend({
      serializer: CustomOnlineSerializer.create(),
      namespace: '/api/v1' // your server namespace
    });

    var OnlineStore = DS.Store.extend({
      adapterFor: function(type) {
        return this.container.lookup('adapter:_custom_store');
      },

      serializerFor: function(type) {
        return this.container.lookup('serializer:_custom_store');
      }
    });

    export default {
      name: "onlineStore",

      initialize: function(container, application) {
        CustomOnlineSerializer.reopen({ container: container });

        container.register('store:online', OnlineStore);
        container.register('adapter:_custom_store', CustomOnlineAdapter);
        container.register('serializer:_custom_store', CustomOnlineSerializer);

        application.inject('route',      'onlineStore', 'store:online');
        application.inject('controller', 'onlineStore', 'store:online');
      }
    };
    ```

2. **Define an offline store:** just define an adapter and serializer as you
would normally do. Here we're using
[IndexedDBAdapter](https://github.com/kurko/ember-indexeddb-adapter). This
offline store will be located at `this.store` by default.

3. **Define an Ember.js initializer:** now we connect Ember Sync with your App.

    ```js
    // app/initializers/ember-sync.js
    import { default as EmberSync } from 'ember-sync';

    export default {
      name: "ember-sync",

      initialize: function(container, application) {
        container.register("lib:emberSync", EmberSync);
        container.register('model:ember-sync-queue-model', EmberSync.create().get('queueModel'));

        application.inject('route', 'emberSync', "lib:emberSync");
        application.inject('controller', 'emberSync', "lib:emberSync");
      }
    };
    ```

    For now, this is a manual step. Later, we'll automate this.

4. **Wire Ember Sync with the stores:** finally, tell Ember Sync what are your
stores instances in your application route. If you're not using
Ember CLI, this is your `ApplicationRoute`:

    ```js
    // app/routes/application.js
    export default Ember.Route.extend({
      init: function() {
        this._super();

        this.emberSync.set('offlineStore', this.store);
        this.emberSync.set('onlineStore',  this.onlineStore);
        this.emberSync.synchronizeOnline();
      }
    });
    ```

    We have to do it manually because we don't know the name of your online
    store.

### Saving records


### Search records



### Conflict resolution and how records are synchronized

Speaking about data consistency, it's very unlikely
that you will ever have problems due to the
the use of a queue in between offline and online envs.

Imagine your REST api takes 10 seconds to respond. You create a record,
then updates it and, finally, deletes it. The online server hasn't even
responded the creation request yet. Ember Sync is smart enough: it will
enqueue creation, then update and then deletion in the online store,
and it will run them in that specific order, even if the record doesn't
exist offline anymore.

The reason for that is that when you do your update locally, you might have
changed an associated model as a consequency. You want that side-effect to
happen in the server too. The order of which you do operations matters.
If the REST api goes down, Ember Sync will stop the queue and resume later
in the same order.

## Roadmap

The following are planned features and areas that needs improvements.

* periodicaly and asynchronously download data from the online store and
push the records into the offline store, so the user can have a enough data
to go offline.
* more granular configuration on how conflicts should be handled.


Tests
-----

First, install depdendencies with bower: `bower install`.

Run `rackup` in your terminal (make sure you have Ruby and the rack gem installed).
Then visit `http://localhost:9292` in your browser.

Please, disregard Travis CI for now because PhantomJS (1.9.3) doesn't support
IndexedDB. IndexedDBShim.js doesn't work
on it either, so I'm running tests only in the browser for now. Once version 2
is here, just use `phantomjs tests/runner.js tests/index.html` in your terminal.

License & Copyright
-------------------

Copyright (c) 2014 Alexandre de Oliveira
MIT Style license. http://opensource.org/licenses/MIT
