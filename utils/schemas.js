const { z } = require('zod');

// --- Auth Schemas ---
const loginSchema = z.object({
  email: z.string().email('Debe ser un correo válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

const registerSchema = z.object({
  email: z.string().email('Debe ser un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['admin', 'designer'], {
    errorMap: () => ({ message: "Rol inválido, debe ser 'admin' o 'designer'" })
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
  active: z.boolean().optional().nullable()
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
  status: z.enum(['nuevo', 'borrador', 'enviado', 'aprobado', 'rechazado', 'completado']).optional(),
  validityDays: z.number().int().positive().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  areas: z.array(z.any()).optional().nullable(),
  totals: z.any().optional().nullable() // Permitimos el envío pero lo recalculará el servidor
});

const updateQuotationStatusSchema = z.object({
  status: z.enum(['nuevo', 'borrador', 'enviado', 'aprobado', 'rechazado', 'completado'], {
    errorMap: () => ({ message: "Estado de cotización inválido" })
  })
});

module.exports = {
  loginSchema,
  registerSchema,
  materialSchema,
  bulkUpsertSchema,
  quotationSchema,
  updateQuotationStatusSchema
};
