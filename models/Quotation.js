const mongoose = require('mongoose');

// Sub-esquemas para las 7 secciones del presupuesto

const supplyItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  providerColor: { type: String, default: '' },
  dimension: { type: String, default: '' },
  unitOfMeasure: { type: String, default: 'LAMINA' },
  quantityMode: { type: String, enum: ['unit', 'sqm'], default: 'unit' },
  quantity: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const edgeBandItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  color: { type: String, default: '' },
  unitOfMeasure: { type: String, default: 'ML' },
  quantity: { type: Number, default: 0 },
  wasteFactor: { type: Number, default: 0 },
  waste: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const accessoryItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  code: { type: String, default: '' },
  dimension: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'UNIDAD' },
  timeHours: { type: Number, default: 0 },
  totalTime: { type: Number, default: 0 },
  laborRate: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const designTimeItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  laborRate: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const cutItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  sqm: { type: Number, default: 0 },
  timeHours: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  laborRate: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const assemblyItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  measurement: { type: String, default: '' },
  unitOfMeasure: { type: String, default: 'm2' },
  assemblyHours: { type: Number, default: 0 },
  persons: { type: Number, default: 2 },
  totalQuantity: { type: Number, default: 0 },
  laborRate: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const installationItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  measurement: { type: String, default: '' },
  unitOfMeasure: { type: String, default: 'm2' },
  installHours: { type: Number, default: 0 },
  persons: { type: Number, default: 2 },
  totalQuantity: { type: Number, default: 0 },
  laborRate: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const veneerItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

const mesonDetailsSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
  materialName: { type: String, default: '' },
  basePricePerM2: { type: Number, default: 0 },
  depth: { type: Number, default: 0.8 },
  transportCost: { type: Number, default: 180000 },
  profitPercentage: { type: Number, default: 68 },
  taxPercentage: { type: Number, default: 19 },
  linearPrice: { type: Number, default: 0 },
  baseCost: { type: Number, default: 0 },
  profitAmount: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  finalPricePerMl: { type: Number, default: 0 }
}, { _id: false });

// Esquema de mueble con las 8 secciones
const furnitureSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  measurements: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: 'SERVICIO' },
  type: { type: String, enum: ['standard', 'custom', 'meson'], default: 'custom' },

  // 7 secciones de presupuesto
  supplies: [supplyItemSchema],
  edgeBands: [edgeBandItemSchema],
  accessories: [accessoryItemSchema],
  designTime: [designTimeItemSchema],
  clientPaidDesign: { type: Boolean, default: false },
  cuts: [cutItemSchema],
  assembly: [assemblyItemSchema],
  installation: [installationItemSchema],
  veneer: [veneerItemSchema],
  mesonDetails: { type: mesonDetailsSchema, default: null },

  // Totales calculados
  totalSupplies: { type: Number, default: 0 },
  totalEdgeBands: { type: Number, default: 0 },
  totalAccessories: { type: Number, default: 0 },
  totalDesignTime: { type: Number, default: 0 },
  totalCuts: { type: Number, default: 0 },
  totalAssembly: { type: Number, default: 0 },
  totalInstallation: { type: Number, default: 0 },
  totalVeneer: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  totalBudget: { type: Number, default: 0 }
});

// Sub-área (para mesones, etc.)
const subAreaItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  measurements: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'ML' },
  price: { type: Number, default: 0 }
}, { _id: false });

const subAreaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  items: [subAreaItemSchema],
  total: { type: Number, default: 0 }
});

// Accesorio visible en la cotización del cliente
const visibleAccessorySchema = new mongoose.Schema({
  description: { type: String, default: '' },
  code: { type: String, default: '' },
  measurements: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'UNIDAD' },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 }
}, { _id: false });

// Área
const areaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  furniture: [furnitureSchema],
  visibleAccessories: [visibleAccessorySchema],
  subAreas: [subAreaSchema],
  areaTotal: { type: Number, default: 0 }
});

// Esquema principal de cotización
const quotationSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  city: {
    type: String,
    default: 'San Juan de Pasto'
  },
  client: {
    name: { type: String, required: true },
    city: { type: String, default: 'Ciudad' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' }
  },
  title: {
    type: String,
    default: 'VENTA, ELABORACIÓN E INSTALACIÓN DE MOBILIARIO'
  },
  areas: [areaSchema],

  // Cálculos finales
  totals: {
    totalCost: { type: Number, default: 0 },
    unforeseenPercent: { type: Number, default: 10 },
    unforeseenAmount: { type: Number, default: 0 },
    profitPercent: { type: Number, default: 35 },
    profitAmount: { type: Number, default: 0 },
    indirectPercent: { type: Number, default: 32 },
    indirectAmount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 19 },
    taxAmount: { type: Number, default: 0 },
    totalWithTax: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 10 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    totalSqm: { type: Number, default: 0 },
    pricePerSqm: { type: Number, default: 0 }
  },

  // Wizard de Configuración Inicial (FASE 0.5)
  wizardConfig: {
    clientPriceMode: {
      type: String,
      enum: ['unit_sqm', 'manual', 'outsource'],
      default: 'unit_sqm'
    },
    hardwareDisplayMode: {
      type: String,
      enum: ['table', 'included', 'selective'],
      default: 'table'
    },
    moTimeMode: {
      type: String,
      enum: ['manual', 'table', 'mixed'],
      default: 'manual'
    },
    requiresDesignFiles: {
      type: Boolean,
      default: false
    },
    designFilesInternal: {
      type: Boolean,
      default: false
    },
    areaDisplayMode: {
      type: String,
      enum: ['subtotals', 'global_only', 'single'],
      default: 'subtotals'
    },
    mesonMode: {
      type: String,
      enum: ['includes_meson', 'no_meson'],
      default: 'no_meson'
    },
    wizardCompleted: {
      type: Boolean,
      default: false
    }
  },

  status: {
    type: String,
    enum: [
      'nuevo', 'borrador', 
      'en_revision', 'auditada', 
      'enviada', 'aceptada', 'aprobada', 
      'rechazada', 
      'archivada_aceptada', 'archivada_rechazada'
    ],
    default: 'nuevo',
    index: true
  },
  paymentTerms: { type: String, default: '' },
  validityDays: { type: Number, default: 3 },
  notes: { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quotation', quotationSchema);
