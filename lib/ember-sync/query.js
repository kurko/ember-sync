import StoreInitMixin from './store-initialization-mixin';
import Persistence from './persistence';

export default Ember.Object.extend(
  StoreInitMixin, {

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

      offlineSearch.then(function(result) {
        if (result.get('id') && !isResolved) {
          resolve(result);
          isResolved = true;
        }
      }, function(error) {
        offlineNotFound = true;
        if (offlineNotFound && onlineNotFound) { reject(error); }
      });

      onlineSearch.then(function(result) {
        var id = result.get('id'),
            persistenceState = _this.offlineStore.find(type, id);

        var persistRecordOffline = function(onlineRecord) {
          var persistence = Persistence.create({
            onlineStore:  _this.onlineStore,
            offlineStore: _this.offlineStore,
          });
          persistence.persistRecordOffline(type, result);
        };

        persistenceState.then(persistRecordOffline, persistRecordOffline);
        if (!isResolved) {
          resolve(result);
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
    if (results.get('length')) {
      results.forEach(function(record) {
        var id = record.get('id'),
            duplicatedId = resultStream.mapBy("id").contains(id);

        if (id && (!resultStream.length || !duplicatedId)) {
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
  },
});
