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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Temporal', temporalSchema);
