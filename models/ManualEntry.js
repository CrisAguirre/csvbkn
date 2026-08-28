const mongoose = require('mongoose');

const manualEntrySchema = new mongoose.Schema({
  quotationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quotation', 
    required: true 
  },
  category: { 
    type: String, 
    enum: ['insumo', 'canto', 'accesorio', 'armado', 'instalacion'],
    required: true 
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Almacena json con precio, cantidad, etc.
    default: {}
  }
}, { 
  timestamps: true 
});

// Índice para búsqueda rápida
manualEntrySchema.index({ category: 1, description: 'text' });
manualEntrySchema.index({ quotationId: 1 });

module.exports = mongoose.model('ManualEntry', manualEntrySchema);
