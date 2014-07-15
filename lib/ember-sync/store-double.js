/**
 * @module StoreDouble
 *
 * Adapters require an object that responds to what Ember Data models respond.
 * Given we use string for `type` and a hash for the record itself, we need
 * to encapsulate it in an object that has the adequate interface for the
 * adapter.
 */
export default Ember.Object.create({
  /**
   * dematerializeRecord is used by LSAdapter
   */
  dematerializeRecord: function() { return true; },

  /**
   * typeMapFor is used by LSAdapter
   */
  typeMapFor: function(type) {
    return {
      idToRecord: { 'nothing': 'nothing' }
    }
  }
});
