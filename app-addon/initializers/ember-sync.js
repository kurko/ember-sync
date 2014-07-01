import EmberSync from 'ember-sync';

export default {
  name: 'ember-sync',

  initialize: function(container, application) {
    container.register("lib:emberSync", EmberSync);
    container.register('model:ember-sync-queue-model', EmberSync.create().get('queueModel'));

    application.inject('route', 'emberSync', "lib:emberSync");
    application.inject('controller', 'emberSync', "lib:emberSync");
  }
};
