const mongoose = require('mongoose');

const STAGES = ['inicio', 'analisis', 'presentacion', 'contratacion', 'preparacion', 'produccion', 'instalacion'];

const stageHistorySchema = new mongoose.Schema({
  stage: { type: String, enum: STAGES, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedByEmail: { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { _id: false });

// Estado en tiempo real por cada uno de los 7 pasos (visible para todos los actores).
// pendiente: aun no inicia · en_curso: etapa actual · completado: terminada
// devuelto: devuelta a reproceso (ej. presentacion->analisis) · bloqueado: pausada por admin
const STAGE_STATE_ENUM = ['pendiente', 'en_curso', 'completado', 'devuelto', 'bloqueado'];
const stageStateSchema = new mongoose.Schema({
  status: { type: String, enum: STAGE_STATE_ENUM, default: 'pendiente' },
  updatedAt: { type: Date, default: Date.now },
  updatedByEmail: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  clientName: { type: String, required: true, trim: true, default: 'Sin Nombre' },
  clientPhone: { type: String, default: '' },
  clientEmail: { type: String, default: '' },
  clientAddress: { type: String, default: '' },
  contactSource: {
    type: String,
    enum: ['redes', 'almacen', 'recomendacion', 'recurrente', 'otro'],
    default: 'otro'
  },
  currentStage: { type: String, enum: STAGES, default: 'inicio', index: true },
  stageHistory: { type: [stageHistorySchema], default: [] },
  stageStates: {
    inicio: { type: stageStateSchema, default: () => ({}) },
    analisis: { type: stageStateSchema, default: () => ({}) },
    presentacion: { type: stageStateSchema, default: () => ({}) },
    contratacion: { type: stageStateSchema, default: () => ({}) },
    preparacion: { type: stageStateSchema, default: () => ({}) },
    produccion: { type: stageStateSchema, default: () => ({}) },
    instalacion: { type: stageStateSchema, default: () => ({}) }
  },
  actors: {
    asesorComercial: { type: String, default: '' },
    contadora: { type: String, default: '' },
    operarios: { type: String, default: '' },
    disenador: { type: String, default: '' },
    asesorDiseno: { type: String, default: '' }
  },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  // Caracteristicas por etapa (flujo local comercial)
  requirement: { type: String, default: '' }, // 1 Inicio: necesidad/requerimiento
  quotationRef: { type: String, default: '' }, // 2 Analisis: numero/ref cotizacion si no hay ObjectId
  feedback: { type: String, default: '' }, // 3 Presentacion: retroalimentacion cliente
  contractNumber: { type: String, default: '' }, // 4 Contratacion: contrato
  designStatus: { type: String, enum: ['pendiente', 'en_proceso', 'aprobado'], default: 'pendiente' }, // 4 planos/disenos
  insumosRequested: { type: Boolean, default: false }, // 5 Preparacion: insumos solicitados
  insumosNotes: { type: String, default: '' }, // 5 preparaciones varias
  productionNotes: { type: String, default: '' }, // 6 Produccion: fabricacion
  deliveryDate: { type: Date, default: null }, // 7 Instalacion/entrega
  finalAmount: { type: Number, default: 0 }, // 7 pago final esperado
  finalPaymentReceived: { type: Boolean, default: false }, // 7 pago final recibido
  deliveryNotes: { type: String, default: '' }, // 7 acta/entrega
  priority: { type: String, enum: ['baja', 'media', 'alta', 'urgente'], default: 'media' },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdByEmail: { type: String, default: '' }
}, { timestamps: true });

projectSchema.index({ title: 'text', clientName: 'text' });

module.exports = mongoose.model('Project', projectSchema);
module.exports.STAGES = STAGES;
