const mongoose = require('mongoose');

const laborTimeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  activityName: {
    type: String,
    required: true
  },
  timeHours: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    enum: ['ML', 'M2', 'UNIDAD', 'LAMINA', 'SERVICIO'],
    default: 'UNIDAD'
  },
  isService: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LaborTime', laborTimeSchema);
