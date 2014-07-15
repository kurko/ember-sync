export default Ember.Mixin.create({
  init: function() {
    this._super();
  },

  offlineStore:     null,
  onlineAdapter:    null,
  onlineSerializer: null
});
