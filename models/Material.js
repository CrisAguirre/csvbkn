const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['melamina', 'canto', 'accesorio', 'herraje', 'vidrio', 'meson', 'otro'],
    index: true
  },
  code: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    trim: true,
    default: ''
  },
  color: {
    type: String,
    trim: true,
    default: ''
  },
  dimension: {
    type: String,
    trim: true,
    default: ''
  },
  unit: {
    type: String,
    required: true,
    enum: ['LAMINA', 'ML', 'UNIDAD', 'SERVICIO', 'KIT', 'TIROS', 'M2', 'SER', 'JUEGO'],
    default: 'UNIDAD'
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  // Campos específicos para melaminas
  pricePerSheet: {
    type: Number,
    default: 0
  },
  measure1: {
    type: Number,
    default: 0
  },
  measure2: {
    type: Number,
    default: 0
  },
  sqmPerSheet: {
    type: Number,
    default: 0
  },
  pricePerSqm: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas
materialSchema.index({ category: 1, description: 'text' });

// Pre-save: calcular M2 y precio por M2 para melaminas
materialSchema.pre('save', function(next) {
  if (this.category === 'melamina' && this.measure1 > 0 && this.measure2 > 0) {
    this.sqmPerSheet = parseFloat(((this.measure1 / 100) * (this.measure2 / 100)).toFixed(4));
    if (this.pricePerSheet > 0 && this.sqmPerSheet > 0) {
      this.pricePerSqm = parseFloat((this.pricePerSheet / this.sqmPerSheet).toFixed(2));
    }
  }
  next();
});

module.exports = mongoose.model('Material', materialSchema);
