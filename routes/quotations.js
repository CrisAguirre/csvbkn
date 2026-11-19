const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const ManualEntry = require('../models/ManualEntry');
const Config = require('../models/Config');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { recalculateAll } = require('../utils/calculator');
const { isPresented, recordVersion } = require('../utils/quotation-versioning');
const { redactHardwarePrices, captureHardwareBases, restoreHardwareBases } = require('../utils/hardware-redaction');
const { compatibleCandidates, mergeQuotations, WINDOW_DAYS } = require('../utils/quotation-merge');
const logger = require('../utils/logger');
const validate = require('../middleware/validate');
const { quotationSchema, updateQuotationStatusSchema } = require('../utils/schemas');

router.use(authMiddleware);

// El frontend envía '' (string vacío) para campos del wizard aún no configurados
// (p. ej. `pricingTier` en modo "Ingreso manual") y para `mesonDetails.materialId`
// cuando el mesón no tiene material. Esos valores hacen fallar los enums y el
// cast a ObjectId de Mongoose (400). Se limpian antes de construir el documento.
function stripTransientKeys(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(stripTransientKeys);
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) {
        delete obj[key];
      } else {
        stripTransientKeys(obj[key]);
      }
    }
  }
}

function normalizeQuotation(data) {
  if (!data || typeof data !== 'object') return data;

  // Limpiar transitorios del wizard (_lamina, _canto, _activity, _isManual, etc.)
  stripTransientKeys(data);
  delete data._id;
  delete data.__v;
  delete data.createdAt;
  delete data.updatedAt;
  // Campos de presentación/versionado son controlados por el servidor.
  delete data.presentedAt;
  delete data.presentedBy;
  delete data.version;
  delete data.versionHistory;

  const wizardEnumFields = ['clientPriceMode', 'hardwareDisplayMode', 'moTimeMode', 'areaDisplayMode', 'mesonMode', 'pricingTier'];
  if (data.wizardConfig) {
    wizardEnumFields.forEach((field) => {
      if (data.wizardConfig[field] === '') delete data.wizardConfig[field];
    });
  }

  if (Array.isArray(data.areas)) {
    data.areas.forEach((area) => {
      if (area && Array.isArray(area.furniture)) {
        area.furniture.forEach((furniture) => {
          if (furniture && furniture.mesonDetails && furniture.mesonDetails.materialId === '') {
            delete furniture.mesonDetails.materialId;
          }
        });
      }
    });
  }

  return data;
}

async function extractAndSaveManualEntries(data, quotationId) {
  if (!data || !Array.isArray(data.areas)) return;

  const entries = [];

  data.areas.forEach((area) => {
    if (area && Array.isArray(area.furniture)) {
      area.furniture.forEach((furn) => {
        const checkAndExtract = (list, categoryName) => {
          if (Array.isArray(list)) {
            list.forEach(item => {
              if (item._isManual) {
                // Remove the volatile flag for the saved details (optional but cleaner)
                const details = { ...item };
                delete details._isManual;
                entries.push({
                  quotationId,
                  category: categoryName,
                  description: item.description || 'Sin descripción',
                  details
                });
              }
            });
          }
        };

        checkAndExtract(furn.supplies, 'insumo');
        checkAndExtract(furn.edgeBands, 'canto');
        checkAndExtract(furn.accessories, 'accesorio');
        checkAndExtract(furn.assembly, 'armado');
        checkAndExtract(furn.installation, 'instalacion');
      });
    }
  });

  if (entries.length > 0) {
    try {
      await ManualEntry.insertMany(entries);
    } catch (e) {
      logger.error('Error saving manual entries:', e);
    }
  }
}


// GET /api/quotations - Listar cotizaciones (visible para todos los usuarios autenticados)
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const filter = {};

    // Visibilidad global: todos ven todas (se conserva createdBy solo para auditoría/edición)

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { 'client.name': { $regex: search, $options: 'i' } },
        { number: parseInt(search) || 0 }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .select('number date client.name status totals.grandTotal city createdAt createdBy createdByEmail presentedAt presentedBy version')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'email role'),
      Quotation.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: quotations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/quotations/stats - Estadísticas para dashboard (global para todos)
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filter = {};

    const [totalQuotations, monthQuotations, statusCounts, monthTotal, allTimeTotal] = await Promise.all([
      Quotation.countDocuments(filter),
      Quotation.countDocuments({ ...filter, createdAt: { $gte: startOfMonth } }),
      Quotation.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Quotation.aggregate([
        { $match: { ...filter, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } }
      ]),
      Quotation.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalQuotations,
        monthQuotations,
        statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        monthTotal: monthTotal[0]?.total || 0,
        allTimeTotal: allTimeTotal[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/quotations/:id - Obtener cotización completa
router.get('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('createdBy', 'email role');
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }
    // Los herrajes no exponen precios a no-admin (afecta también al PDF).
    const data = req.user.role === 'admin' ? quotation : redactHardwarePrices(quotation);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/quotations - Crear cotización
router.post('/', validate(quotationSchema), async (req, res) => {
  try {
    normalizeQuotation(req.body);

    let config;
    let finalNumber = req.body.number;

    if (finalNumber && finalNumber > 0) {
      // Usar el número digitado por el operario
      config = await Config.findOne({ key: 'global' });
      if (config && finalNumber >= config.nextQuotationNumber) {
        // Actualizar el consecutivo si el digitado es mayor o igual
        await Config.findOneAndUpdate(
          { key: 'global' },
          { $set: { nextQuotationNumber: Number(finalNumber) + 1 } }
        );
      }
    } else {
      // Obtener siguiente número si no se digitó ninguno
      config = await Config.findOneAndUpdate(
        { key: 'global' },
        { $inc: { nextQuotationNumber: 1 } },
        { new: false }
      );
      if (config) {
        finalNumber = config.nextQuotationNumber;
      }
    }

    if (!config) {
      return res.status(500).json({ success: false, message: 'Error al obtener número de cotización.' });
    }

    // UPSERT: si ya existe una cotizacion con ese numero, sobrescribirla
    const existingByNumber = await Quotation.findOne({ number: finalNumber });
    if (existingByNumber) {
      if (req.user.role !== 'admin' && existingByNumber.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Ya existe la cotizacion No.' + finalNumber + ' de otro usuario.' });
      }
      if (isPresented(existingByNumber) && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'La cotización ya fue presentada al cliente. Solo un administrador puede editarla.' });
      }
      if (isPresented(existingByNumber)) recordVersion(existingByNumber, req.user, 'Edición de cotización presentada');
      const hardwareBases = req.user.role === 'admin' ? null : captureHardwareBases(existingByNumber);
      const updateData = { ...req.body, number: finalNumber };
      delete updateData.createdBy;
      delete updateData.createdByEmail;
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      existingByNumber.set(updateData);
      restoreHardwareBases(existingByNumber, hardwareBases);
      const cfg2 = config || await Config.findOne({ key: 'global' });
      if (cfg2) recalculateAll(existingByNumber, cfg2);
      existingByNumber.markModified('areas');
      existingByNumber.markModified('totals');
      existingByNumber.markModified('wizardConfig');
      existingByNumber.markModified('products');
      existingByNumber.markModified('designs');
      await existingByNumber.save();
      await extractAndSaveManualEntries(req.body, existingByNumber._id);
      return res.status(200).json({
        success: true,
        data: req.user.role === 'admin' ? existingByNumber : redactHardwarePrices(existingByNumber),
        message: `Cotizacion No.${finalNumber} sobrescrita exitosamente.`
      });
    }

    const quotationData = {
      ...req.body,
      number: finalNumber,
      createdBy: req.user.id,
      createdByEmail: req.user.email || req.body.createdByEmail || '',
      paymentTerms: req.body.paymentTerms || config.paymentTerms,
      validityDays: req.body.validityDays || config.validityDays
    };

    recalculateAll(quotationData, config);

    const quotation = new Quotation(quotationData);
    await quotation.save();

    // Guardar entradas manuales
    await extractAndSaveManualEntries(req.body, quotation._id);

    res.status(201).json({
      success: true,
      data: req.user.role === 'admin' ? quotation : redactHardwarePrices(quotation),
      message: `Cotización No.${quotation.number} creada exitosamente.`
    });
  } catch (error) {
    logger.error('Error creando cotización: ' + error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/quotations/:id - Actualizar cotización
router.put('/:id', validate(quotationSchema), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }

    // Presentada al cliente: queda cerrada; solo admin puede editarla y cada
    // edición genera una versión nueva con fecha y usuario.
    if (isPresented(quotation) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'La cotización ya fue presentada al cliente. Solo un administrador puede editarla.' });
    }
    // Roles no-admin solo pueden editar borradores propios
    if (req.user.role !== 'admin') {
      if (quotation.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para editar esta cotización.' });
      }
      if (quotation.status !== 'borrador' && quotation.status !== 'nuevo') {
        return res.status(400).json({ success: false, message: 'Solo se pueden editar cotizaciones en estado borrador o nuevo.' });
      }
    }
    if (isPresented(quotation)) recordVersion(quotation, req.user, 'Edición de cotización presentada');
    const hardwareBases = req.user.role === 'admin' ? null : captureHardwareBases(quotation);

    const updateData = { ...req.body };
    normalizeQuotation(updateData);
    // Permitir actualizar el número si el frontend lo envía modificado
    // delete updateData.number;
    delete updateData.createdBy;
    delete updateData.createdByEmail;
    delete updateData._id; // Prevenir error de Mongoose al modificar el _id
    delete updateData.createdAt;
    delete updateData.updatedAt;

    quotation.set(updateData);
    restoreHardwareBases(quotation, hardwareBases);

    // Forzar cálculo seguro en el backend
    const config = await Config.findOne({ key: 'global' });
    if (config) {
      recalculateAll(quotation, config);
    }

    quotation.markModified('areas');
    quotation.markModified('totals');
    quotation.markModified('wizardConfig');
    quotation.markModified('products');
    quotation.markModified('designs');

    await quotation.save();

    // Guardar entradas manuales (se duplicarían si editan lo mismo, lo ideal es guardarlas como log)
    await extractAndSaveManualEntries(req.body, quotation._id);

    res.json({
      success: true,
      data: req.user.role === 'admin' ? quotation : redactHardwarePrices(quotation),
      message: 'Cotización actualizada exitosamente.'
    });
  } catch (error) {
    logger.error('Error actualizando cotización ' + req.params.id + ': ' + error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/quotations/:id/status - Cambiar estado (solo admin)
router.patch('/:id/status', requireAdmin, validate(updateQuotationStatusSchema), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      'nuevo', 'borrador', 
      'en_revision', 'auditada', 
      'enviada', 'aceptada', 'aprobada', 
      'rechazada', 
      'archivada_aceptada', 'archivada_rechazada'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado no válido.' });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }

    // Enviar al cliente también marca el punto de inflexión si aún no estaba presentada.
    if (status === 'enviada' && !isPresented(quotation)) {
      quotation.presentedAt = new Date();
      quotation.presentedBy = req.user.email || '';
    }
    quotation.status = status;
    await quotation.save();

    res.json({ success: true, data: quotation, message: `Estado cambiado a "${status}".` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/quotations/:id/merge-candidates - Cotizaciones compatibles para fusionar (solo admin)
router.get('/:id/merge-candidates', requireAdmin, async (req, res) => {
  try {
    const target = await Quotation.findById(req.params.id).select('number date client.name');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }
    const name = String(target.client?.name || '').trim();
    const candidates = await Quotation.find({
      _id: { $ne: target._id },
      'client.name': { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    })
      .select('number date client.name status totals.grandTotal')
      .sort('date');
    const allowed = compatibleCandidates(target, candidates, WINDOW_DAYS);
    res.json({
      success: true,
      data: allowed.map((q) => ({
        _id: q._id,
        number: q.number,
        date: q.date,
        clientName: q.client?.name,
        status: q.status,
        grandTotal: q.totals?.grandTotal || 0
      })),
      windowDays: WINDOW_DAYS
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/quotations/:id/merge - Fusionar cotizaciones del mismo cliente (solo admin)
router.post('/:id/merge', requireAdmin, async (req, res) => {
  try {
    const target = await Quotation.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Selecciona al menos una cotización compatible.' });
    }
    const sources = await Quotation.find({ _id: { $in: ids } });
    const allowed = compatibleCandidates(target, sources, WINDOW_DAYS);
    if (allowed.length !== sources.length) {
      return res.status(400).json({
        success: false,
        message: 'Algunas cotizaciones no son compatibles (cliente distinto o fuera de la ventana de 7 días).'
      });
    }

    const merged = mergeQuotations(target, allowed);
    const config = await Config.findOneAndUpdate(
      { key: 'global' },
      { $inc: { nextQuotationNumber: 1 } },
      { new: false }
    );
    if (!config) return res.status(500).json({ success: false, message: 'No se pudo obtener el consecutivo.' });
    merged.number = config.nextQuotationNumber;
    merged.date = new Date();
    merged.createdBy = req.user.id;
    merged.createdByEmail = req.user.email || '';
    merged.wizardConfig = merged.wizardConfig || {};
    merged.wizardConfig.wizardCompleted = true;

    recalculateAll(merged, config);
    const consolidated = new Quotation(merged);
    await consolidated.save();

    res.status(201).json({
      success: true,
      data: consolidated,
      message: `Cotización consolidada No.${consolidated.number} creada a partir de ${allowed.length + 1} cotizaciones.`
    });
  } catch (error) {
    logger.error('Error fusionando cotización ' + req.params.id + ': ' + error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/quotations/:id/present - Marcar la presentación inicial al cliente
router.post('/:id/present', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }
    if (req.user.role !== 'admin' && quotation.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tiene permisos para presentar esta cotización.' });
    }
    if (!isPresented(quotation)) {
      quotation.presentedAt = new Date();
      quotation.presentedBy = req.user.email || '';
      await quotation.save();
    }
    res.json({
      success: true,
      data: req.user.role === 'admin' ? quotation : redactHardwarePrices(quotation),
      message: isPresented(quotation)
        ? `Cotización No.${quotation.number} marcada como presentada.`
        : `Cotización No.${quotation.number} ya estaba presentada.`
    });
  } catch (error) {
    logger.error('Error presentando cotización ' + req.params.id + ': ' + error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/quotations/:id/duplicate - Duplicar cotización
router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await Quotation.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }

    const config = await Config.findOneAndUpdate(
      { key: 'global' },
      { $inc: { nextQuotationNumber: 1 } },
      { new: false }
    );

    const duplicateData = original.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    // La copia es un borrador nuevo: no hereda presentación ni versiones.
    delete duplicateData.presentedAt;
    delete duplicateData.presentedBy;
    delete duplicateData.version;
    delete duplicateData.versionHistory;
    duplicateData.number = config.nextQuotationNumber;
    duplicateData.status = 'borrador';
    duplicateData.createdBy = req.user.id;
    duplicateData.createdByEmail = req.user.email || '';
    duplicateData.date = new Date();

    // Generar nuevos _id para subdocumentos
    const duplicate = new Quotation(duplicateData);
    await duplicate.save();

    res.status(201).json({
      success: true,
      data: req.user.role === 'admin' ? duplicate : redactHardwarePrices(duplicate),
      message: `Cotización duplicada como No.${duplicate.number}.`
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/quotations/:id - Eliminar cotización (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }
    res.json({ success: true, message: `Cotización No.${quotation.number} eliminada.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
