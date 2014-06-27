/**
 * location is online or offline
 */
var getModelLS = function(location, model, id) {
  var result = [],
      database;

  database = JSON.parse(localStorage.getItem(location+"Store"));

  if (model && id) {
    return database[model].records[id];
  } else if (model) {

    if (database[model]) {
      for (record in database[model].records) {
        result.push(database[model].records[record]);
      }
    }

    return result;
  } else {
    return database;
  }
}

/**
 * location is online or offline
 */
var resetLocalStorage = function(location) {
  if (location) {
    localStorage.removeItem(location+"Store");
  } else {
    localStorage.clear();
  }
  setupLocalStorage();
}

var setupLocalStorage = function() {
  var envs = ["online", "offline"];

  for(index in envs) {
    if (!localStorage.getItem(envs[index]+"Store") && envs.hasOwnProperty(index)) {
      localStorage.setItem(envs[index]+"Store", JSON.stringify({}));
    }
  }
}
