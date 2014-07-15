import StoreInitMixin from './store-initialization-mixin';
import Persistence    from './persistence';
import ModelDouble    from './model-double';
import StoreDouble    from './store-double';

var debugging = true;

export default Ember.Object.extend(
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
    var _this = this,
        modelDouble = ModelDouble(type),
        store = StoreDouble,
        onlineAdapter = this.get('onlineAdapter').create(),
        offlineSearch, onlineSearch;

    // FIXME improve this
    if(Ember.isNone(query)) {
      offlineSearch = this.offlineStore.find(type);
      onlineSearch  = this.onlineStore.find(type);
    } else {
      offlineSearch = this.offlineStore.find(type, query);
      console.log('1 type', modelDouble);
      console.log('1 relationshipName', Ember.get(modelDouble, 'relationshipNames'));
      console.log('1 original type', Ember.get(type, 'relationshipNames'));
      onlineSearch  = onlineAdapter.find(StoreDouble, modelDouble, query);
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
        var id = record.id,
            persistenceState = _this.offlineStore.find(type, id),
            newRecord;

        var persistRecordOffline = function(onlineRecord) {
          var persistence = Persistence.create({
            onlineStore:  _this.onlineStore,
            offlineStore: _this.offlineStore,
          });

          newRecord = persistence.persistRecordOffline(type, record);

          if (!isResolved) {
            _this.onRecordAdded(newRecord);
            resolve(newRecord);
            isResolved = true;
          }
        };

        persistenceState.then(persistRecordOffline, persistRecordOffline);
      }, function(error) {
        if (debugging)
          console.error(error);

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
