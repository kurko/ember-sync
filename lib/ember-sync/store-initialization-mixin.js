export default Ember.Mixin.create({
  init: function() {
    this._super();
    // FIXME remove this
    var onlineStore  = this.onlineStore,
        offlineStore = this.offlineStore;

    if (this.container) {
      this.set('container', this.container);

      if (!onlineStore)
        onlineStore = this.container.onlineStore;

      if (!offlineStore)
        offlineStore = this.container.store;
    }

    this.set('offlineStore', offlineStore);
    this.set('onlineStore',  onlineStore);
  },

  container: null,
  offlineStore: null,
  onlineStore: null,
});
