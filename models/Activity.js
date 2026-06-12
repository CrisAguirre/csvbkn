const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['login', 'logout'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', activitySchema);
