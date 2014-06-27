var myDate = function(offset) {
  var t = new Date;
  if (offset) {
    t.setDate(t.getDate() + offset);
  }
  return t;
};
