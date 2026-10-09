const { z } = require('zod');

// --- Auth Schemas ---
const loginSchema = z.object({
  email: z.string().email('Debe ser un correo válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

const registerSchema = z.object({
  email: z.string().email('Debe ser un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['admin', 'comercial', 'contabilidad', 'diseno'], {
    errorMap: () => ({ message: "Rol inválido, debe ser 'admin', 'comercial', 'contabilidad' o 'diseno'" })
  })
});

// --- Material Schemas ---
const materialSchema = z.object({
  category: z.enum(['melamina', 'canto', 'accesorio', 'herraje', 'vidrio', 'meson', 'laminado', 'compactslab', 'duraopak', 'tablero', 'otro'], {
    errorMap: () => ({ message: "Categoría inválida" })
  }),
  code: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1, 'La descripción es requerida'),
  provider: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  dimension: z.string().trim().optional().nullable(),
  unit: z.enum(['LAMINA', 'ML', 'UNIDAD', 'SERVICIO', 'KIT', 'TIROS', 'TIRO', 'M2', 'SER', 'JUEGO']).default('UNIDAD').optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable(),
  pricePerSheet: z.number().nonnegative().optional().nullable(),
  measure1: z.number().nonnegative().optional().nullable(),
  measure2: z.number().nonnegative().optional().nullable(),
  active: z.boolean().optional().nullable(),
  calibre: z.string().trim().optional().nullable(),
  tipo: z.string().trim().optional().nullable(),
  rigidez: z.string().trim().optional().nullable(),
  moMinutesPerMl: z.number().nonnegative().optional().nullable()
});

const bulkUpsertSchema = z.object({
  materials: z.array(z.any()).min(1, 'Se requiere al menos un material en el arreglo'),
  replaceProvider: z.string().optional().nullable()
});

// --- Quotation Schemas ---
// Validación superficial para cotizaciones (dada su enorme profundidad)
const quotationSchema = z.object({
  clientName: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['nuevo', 'borrador', 'en_revision', 'auditada', 'enviada', 'aceptada', 'aprobada', 'rechazada', 'archivada_aceptada', 'archivada_rechazada']).optional(),
  validityDays: z.number().int().positive().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  areas: z.array(z.any()).optional().nullable(),
  totals: z.any().optional().nullable() // Permitimos el envío pero lo recalculará el servidor
});

const updateQuotationStatusSchema = z.object({
  status: z.enum(['nuevo', 'borrador', 'en_revision', 'auditada', 'enviada', 'aceptada', 'aprobada', 'rechazada', 'archivada_aceptada', 'archivada_rechazada'], {
    errorMap: () => ({ message: "Estado de cotización inválido" })
  })
});

// --- Project Schemas (monitor secuencial 7 etapas) ---
const projectSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido'),
  clientName: z.string().trim().min(1, 'El cliente es requerido'),
  clientPhone: z.string().optional().nullable(),
  clientEmail: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  contactSource: z.enum(['redes', 'almacen', 'recomendacion', 'recurrente', 'otro']).optional(),
  currentStage: z.enum(['inicio', 'analisis', 'presentacion', 'contratacion', 'preparacion', 'produccion', 'instalacion']).optional(),
  stageNotes: z.string().optional().nullable(),
  actors: z.object({
    asesorComercial: z.string().optional().nullable(),
    contadora: z.string().optional().nullable(),
    operarios: z.string().optional().nullable(),
    disenador: z.string().optional().nullable(),
    asesorDiseno: z.string().optional().nullable()
  }).partial().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  requirement: z.string().optional().nullable(),
  quotationRef: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  contractNumber: z.string().optional().nullable(),
  designStatus: z.enum(['pendiente', 'en_proceso', 'aprobado']).optional(),
  insumosRequested: z.boolean().optional().nullable(),
  insumosNotes: z.string().optional().nullable(),
  productionNotes: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  finalAmount: z.number().nonnegative().optional().nullable(),
  finalPaymentReceived: z.boolean().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional().nullable()
});

const updateProjectStageSchema = z.object({
  stage: z.enum(['inicio', 'analisis', 'presentacion', 'contratacion', 'preparacion', 'produccion', 'instalacion'], {
    errorMap: () => ({ message: "Etapa inválida" })
  }),
  notes: z.string().optional().nullable(),
  feedback: z.string().optional().nullable()
});

const updateStageStateSchema = z.object({
  stage: z.enum(['inicio', 'analisis', 'presentacion', 'contratacion', 'preparacion', 'produccion', 'instalacion'], {
    errorMap: () => ({ message: "Etapa inválida" })
  }),
  status: z.enum(['pendiente', 'en_curso', 'completado', 'devuelto', 'bloqueado'], {
    errorMap: () => ({ message: "Estado inválido" })
  }),
  notes: z.string().optional().nullable()
});

module.exports = {
  loginSchema,
  registerSchema,
  materialSchema,
  bulkUpsertSchema,
  quotationSchema,
  updateQuotationStatusSchema,
  projectSchema,
  updateProjectStageSchema,
  updateStageStateSchema
};
