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
  category: {
    type: String,
    enum: ['armado', 'instalacion'],
    default: ''
  },
  minutes: {
    type: Number,
    default: 0
  },
  valorMinuto: {
    type: Number,
    default: 0
  },
  persons: {
    type: Number,
    default: 1
  },
  quantity: {
    type: Number,
    default: 1
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
