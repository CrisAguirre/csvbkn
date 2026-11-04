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
  // Detalle por submodulo (informacion tecnica en tiempo real por paso)
  stageDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  stepUpdates: [{
    stage: { type: String, enum: STAGES, required: true },
    substep: { type: String, default: '' },
    status: { type: String, enum: ['pendiente', 'en_curso', 'completado', 'bloqueado'], default: 'pendiente' },
    responsible: { type: String, default: '' },
    notes: { type: String, default: '' },
    byEmail: { type: String, default: '' },
    byRole: { type: String, default: '' },
    kind: { type: String, enum: ['normal', 'solicitud_ajuste', 'ajuste_aplicado'], default: 'normal' },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  }],
  // Campos detallados por etapa (estructura secuencia Spazio Vitale)
  // Etapa 1 Inicio
  needType: { type: String, default: '' }, // compra|fabricacion|etc
  designBudget: { type: Number, default: 0 }, // presupuesto de diseno
  designPaymentReceived: { type: Boolean, default: false }, // pago de diseno
  receptionNotes: { type: String, default: '' },
  // Etapa 2 Desarrollo
  designElaborationNotes: { type: String, default: '' },
  designPresentationNotes: { type: String, default: '' },
  materialsConfirmed: { type: Boolean, default: false },
  // Etapa 3 Presentacion
  quotationSocializationNotes: { type: String, default: '' },
  appliancesSocializationNotes: { type: String, default: '' },
  // Etapa 4 Contratacion
  contractElaborated: { type: Boolean, default: false },
  plansElaborated: { type: Boolean, default: false },
  documentsSignedClient: { type: Boolean, default: false },
  documentsSignedAdmin: { type: Boolean, default: false },
  payment60Received: { type: Boolean, default: false },
  // Etapa 5 Preparacion
  designerDocumentSent: { type: Boolean, default: false },
  materialsOrderReady: { type: Boolean, default: false },
  materialsChecklistDone: { type: Boolean, default: false },

  // Etapa 6 Fabricación / Producción (según fabricacion y entrega.md de fábrica)
  // 6.1 Ingresa contrato
  contractPlansSigned: { type: Boolean, default: false },
  contractSigned: { type: Boolean, default: false },
  appliancesConfirmed: { type: Boolean, default: false },
  appliancesNotes: { type: String, default: '' },
  // 6.2 Pedidos y seguimiento de materiales
  orderMelamines: { type: Boolean, default: false },
  orderEdges: { type: Boolean, default: false },
  orderFittings: { type: Boolean, default: false },
  orderCountertop: { type: Boolean, default: false },
  orderEstimatedArrival: { type: String, default: '' },
  orderFollowupNotes: { type: String, default: '' },
  // 6.3 Identificar fechas de instalación y programación de obra
  targetDeliveryDate: { type: Date, default: null },
  measurementsRectificationDate: { type: Date, default: null },
  mepPlansReady: { type: Boolean, default: false },
  cuttingListScheduled: { type: Boolean, default: false },
  productionTasksScheduled: { type: Boolean, default: false },
  // 6.4 Rectificación final de medidas
  estimatedCompletionDate: { type: Date, default: null },
  mepPlansVerifiedOnSite: { type: Boolean, default: false },
  rectificationNotes: { type: String, default: '' },
  // 6.5 Elaboración final de despiece
  cutAndEdgePlansDone: { type: Boolean, default: false },
  assemblyPlansDone: { type: Boolean, default: false },
  // 6.6 Inicio y finalización de producción
  materialsAvailabilityVerified: { type: Boolean, default: false },
  cuttingDone: { type: Boolean, default: false },
  edgingDone: { type: Boolean, default: false },
  assemblyDone: { type: Boolean, default: false },
  fittingsInstalled: { type: Boolean, default: false },
  workshopCompletionDone: { type: Boolean, default: false },

  // Etapa 7 Entrega e Instalación (según fabricacion y entrega.md de fábrica)
  // 7.1 Verificación de la obra
  civilWorkFinished: { type: Boolean, default: false },
  civilWorkNotes: { type: String, default: '' },
  // 7.2 Control de calidad despacho e instalación
  qualityControlFormSigned: { type: Boolean, default: false },
  qualityControlNotes: { type: String, default: '' },
  // 7.3 Formalización de la entrega
  deliveryFormSigned: { type: Boolean, default: false },
  deliveryDate: { type: Date, default: null }, // Fecha de entrega final
  finalAmount: { type: Number, default: 0 }, // Pago final esperado
  finalPaymentReceived: { type: Boolean, default: false }, // Pago final recibido
  deliveryNotes: { type: String, default: '' }, // Acta / notas de entrega
  // 7.4 Seguimiento al cliente
  maintenanceManualDelivered: { type: Boolean, default: false },
  customerFollowupNotes: { type: String, default: '' },

  priority: { type: String, enum: ['baja', 'media', 'alta', 'urgente'], default: 'media' },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdByEmail: { type: String, default: '' }
}, { timestamps: true });

projectSchema.index({ title: 'text', clientName: 'text' });

module.exports = mongoose.model('Project', projectSchema);
module.exports.STAGES = STAGES;
