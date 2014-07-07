Ember Sync [![Build Status](https://travis-ci.org/kurko/ember-sync.svg?branch=master)](https://travis-ci.org/kurko/ember-sync)
================================

Ember Sync allows your Ember.js application to seamlessly work online and offline.

**Alpha version:** beware of the risks if you want to try it in production.

This README documents the state of master, probably there is features
described here that do not reflect the status of previous/latest releases.

### How it works

Ember Sync has a queue of operations. Every time you save, update or delete
a record in your offline database (e.g LocalStorage, IndexedDB etc) as you
usually do, a new operation is created in the queue.

The queue is processed in order and each operation is executed
against the online store. If internet goes offline or your server is down, the
queue stops being processed. No operations will be run concurrently and the
order will always be respected.

While you have no internet connection, you can continue using your app and
all data will be saved offline while new operations will continue being
enqueued. When internet is restored, the queue will continue being processed
and pending records will be created or updated against the online store.

![Ember Sync](http://f.cl.ly/items/2j113g1q0U1L3v3n0W3t/embersync.png)

#### Requirements

* Ember Data is required (tested against 1.0.0-beta.8).
* You should generate a unique ID for your records (e.g UUID)
in the client and backend to maintain consistency between offline
and online data.

### Querying online records

Whenever you search something, Ember Sync will automatically
query concurrently both offline and online stores and merge the results into
a single Ember array.

This means that `findQuery` returns an `Ember.A()` right away instead of a
promise. If 2 seconds later a response comes from the REST api, Ember Sync
will push new records to that array that was already being shown in the
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

#### Installation

##### Ember CLI >= 0.0.37
1. Run `npm install --save ember-sync` in your project

##### Ember CLI < 0.0.37
1. Add `"ember-sync": "^0.1.0"` as a dependency in your `bower.json` file.

2. Add the following to you `Brofile.js` and restart your server:

    ```js
    app.import('vendor/ember-sync/dist/ember-sync.js', { 'ember-sync': [ 'default' ] });
    ```

#### Initialization

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

    **Important:** if you're using an offline store that requires you to
    manually create tables/object stores, create `emberSyncQueueModel`.
    For example, LSAdapter will create it automatically for you, whereas in
    IndexedDB you will have to do it yourself.

3. **Define an Ember.js initializer:** now we connect Ember Sync with your App.

    If you are using the ember-addon version(installed with npm in am ember-cli > 0.0.36) project, you can skip this step.

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

    **Important:** remember to call `this.emberSync.synchronizeOnline()`. This
    will activate the loop that will take care of the queue.

#### Creating records

To save records, do the following:

```js
var user, book;

user = this.emberSync.createRecord('user', { name: 'Robinson Crusoe' });
book = this.emberSync.createRecord('book', { name: 'The Life of Robinson Crusoe', });
user.get('books').pushObject(book);

user.emberSync.save().then(function(user) {
  book.emberSync.save();
});
```

`createRecord` and `deleteRecord`, which are commonly called on `this.store`,
are now called on `this.emberSync`. From there on, just call `.emberSync.save()` on the
models as you normally would.

In the example above, `user` and `book` could be used in your controllers just
fine. `this.emberSync.createRecord` returns essentially the same
as `this.store.createRecord`. For instance:

```js
// app/routes/user.js
export default Ember.Route.extend({
  model: function() {
    return this.emberSync.createRecord('user', {name: 'Robinson'});
  }
});
```

#### Finding records

To find records, just do:

```js
users = this.emberSync.findQuery('user', {name: 'Robinson Crusoe'});
```

This will automatically search for that user in both offline and online stores.
Remember that `findQuery` doesn't return a promise, but `Ember.A()` instead.
For instance, if a record is found offline in 50 miliseconds, it'll show up in your template
right away. If another record is then found in your RESTAdapter-based store 3
seconds later, the
array is automatically populated, simulating streams.

Instead of `findQuery`, you can use `find` as well, but it will return a
Promise:

```js
user = this.emberSync.find('user', 1);
```

#### Deleting records

To delete a record, do the following:

```js
this.emberSync.deleteRecord('user', record);
record.emberSync.save();
```

### Synchronization during download

When doing `findQuery` or `find`, Ember Sync will automatically save the records
found online in the offline store.

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

#### Distributed data consistency

Ember Sync will not, however, solve the problem of

> computer 1 and computer 2 are offline, record 1 is altered in both

This sort of conflict should be
dealt by your backend. Although we plan to build an API to help you figure
that out in the client, we advise you to architecture your network of
clients to avoid such conflicts in the first place.

## Roadmap

The following are planned features and areas that need improvements.

* periodicaly and asynchronously download data from the online store and
push the records into the offline store, so the user can have a enough data
to go offline.
* more granular configuration on how conflicts should be handled.
* refactor code to smaller objects.
* encapsulate initializer so user doesn't have to write it explicitly.

Tests & Build
-----

First, install depdendencies with `npm install` and `bower install`. Then run
`broccoli serve`.

Visit `http://localhost:4200/tests`.

If you prefer, use `npm run-script test-all` in your terminal. You need to
have PhantomJS installed.

To build a new version, just run `npm run-script build`. The build will be
available in the `dist/` directory.

License & Copyright
-------------------

Copyright (c) 2014 Alexandre de Oliveira
MIT Style license. http://opensource.org/licenses/MIT
