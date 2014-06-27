export default DS.Model.extend({
  jobRecordType: DS.attr('string'),
  serialized:    DS.attr(),
  operation:     DS.attr('string'),
  createdAt:     DS.attr('string'),
});
