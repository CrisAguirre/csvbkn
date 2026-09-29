const mongoose = require('mongoose');

const temporalSchema = new mongoose.Schema({
  clientName: {
    type: String,
    default: 'Sin Nombre'
  },
  currentStepName: {
    type: String,
    default: 'Inicio'
  },
  currentStepNumber: {
    type: Number,
    default: 1
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdByEmail: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Temporal', temporalSchema);
