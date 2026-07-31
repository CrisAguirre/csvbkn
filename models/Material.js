const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['melamina', 'canto', 'accesorio', 'herraje', 'vidrio', 'meson', 'laminado', 'compactslab', 'duraopak', 'otro'],
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
  brand: {
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
    enum: ['LAMINA', 'ML', 'UNIDAD', 'SERVICIO', 'KIT', 'TIROS', 'TIRO', 'M2', 'SER', 'JUEGO'],
    default: 'UNIDAD'
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  // --- Nuevos campos para precios escalonados (Ej. Duropak) ---
  pricePublic: {
    type: Number,
    default: 0
  },
  pricePublicVol: {
    type: Number,
    default: 0
  },
  priceIndustrial: {
    type: Number,
    default: 0
  },
  priceIndustrialVol: {
    type: Number,
    default: 0
  },
  volThreshold: {
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
  },
  laborMinutes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas
materialSchema.index({ category: 1, description: 'text' });

// Pre-save: calcular M2 y precio por M2 para melaminas
// Las medidas del Excel vienen en metros (ej: 1.83 × 2.44 = 4.4652 M²).
// Si ambas medidas son < 10, se asumen metros directamente.
// Si son >= 10, se asumen centímetros y se dividen entre 100.
materialSchema.pre('save', function() {
  if (this.category === 'melamina' && this.measure1 > 0 && this.measure2 > 0) {
    const m1 = this.measure1 < 10 ? this.measure1 : this.measure1 / 100;
    const m2 = this.measure2 < 10 ? this.measure2 : this.measure2 / 100;
    this.sqmPerSheet = parseFloat((m1 * m2).toFixed(4));
    if (this.pricePerSheet > 0 && this.sqmPerSheet > 0) {
      this.pricePerSqm = parseFloat((this.pricePerSheet / this.sqmPerSheet).toFixed(2));
    }
  }
});

module.exports = mongoose.model('Material', materialSchema);
