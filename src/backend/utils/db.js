const mongoose = require('mongoose');

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  isMongoReady: isMongoReady
};
