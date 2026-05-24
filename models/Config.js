const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  // Clave única para que solo exista un documento de configuración
  key: {
    type: String,
    default: 'global',
    unique: true
  },
  laborRatePerHour: {
    type: Number,
    default: 12495
  },
  designRatePerHour: {
    type: Number,
    default: 16780
  },
  unforeseenPercent: {
    type: Number,
    default: 10
  },
  profitPercent: {
    type: Number,
    default: 35
  },
  indirectPercent: {
    type: Number,
    default: 32
  },
  taxPercent: {
    type: Number,
    default: 19
  },
  defaultDiscount: {
    type: Number,
    default: 10
  },
  nextQuotationNumber: {
    type: Number,
    default: 2700
  },
  wasteTable: [{
    minMl: { type: Number, required: true },
    maxMl: { type: Number, required: true },
    factor: { type: Number, required: true }
  }],
  paymentTerms: {
    type: String,
    default: 'ABONO INICIAL DEL 60% en efectivo, transacción o cheque al concretar la obra y aprobación de diseños.\nABONO INICIAL DEL 35% en efectivo, transacción o cheque al iniciar instalación en obra.\nPAGO SALDO: 5% restante en efectivo, a la entrega e instalación total de la obra a satisfacción.'
  },
  validityDays: {
    type: Number,
    default: 3
  },
  companyName: {
    type: String,
    default: 'Spazio Vitales sas'
  },
  city: {
    type: String,
    default: 'San Juan de Pasto'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Config', configSchema);
