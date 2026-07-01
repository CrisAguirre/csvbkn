const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const Config = require('../models/Config');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/quotations - Listar cotizaciones
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const filter = {};

    // Diseñadores solo ven sus cotizaciones, admin ve todas
    if (req.user.role === 'designer') {
      filter.createdBy = req.user.id;
    }

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
        .select('number date client.name status totals.grandTotal city createdAt')
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

// GET /api/quotations/stats - Estadísticas para dashboard
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filter = {};
    if (req.user.role === 'designer') {
      filter.createdBy = req.user.id;
    }

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
    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/quotations - Crear cotización
router.post('/', async (req, res) => {
  try {
    // Obtener siguiente número
    const config = await Config.findOneAndUpdate(
      { key: 'global' },
      { $inc: { nextQuotationNumber: 1 } },
      { new: false }
    );

    if (!config) {
      return res.status(500).json({ success: false, message: 'Error al obtener número de cotización.' });
    }

    const quotationData = {
      ...req.body,
      number: config.nextQuotationNumber,
      createdBy: req.user.id,
      paymentTerms: req.body.paymentTerms || config.paymentTerms,
      validityDays: req.body.validityDays || config.validityDays
    };

    const quotation = new Quotation(quotationData);
    await quotation.save();

    res.status(201).json({
      success: true,
      data: quotation,
      message: `Cotización No.${quotation.number} creada exitosamente.`
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/quotations/:id - Actualizar cotización
router.put('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }

    // Diseñadores solo pueden editar borradores propios
    if (req.user.role === 'designer') {
      if (quotation.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para editar esta cotización.' });
      }
      if (quotation.status !== 'borrador' && quotation.status !== 'nuevo') {
        return res.status(400).json({ success: false, message: 'Solo se pueden editar cotizaciones en estado borrador o nuevo.' });
      }
    }

    const updateData = { ...req.body };
    delete updateData.number; // No permitir cambiar el número
    delete updateData.createdBy;

    Object.assign(quotation, updateData);
    await quotation.save();

    res.json({ success: true, data: quotation, message: 'Cotización actualizada exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/quotations/:id/status - Cambiar estado (solo admin)
router.patch('/:id/status', requireAdmin, async (req, res) => {
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

    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    }

    res.json({ success: true, data: quotation, message: `Estado cambiado a "${status}".` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    duplicateData.number = config.nextQuotationNumber;
    duplicateData.status = 'borrador';
    duplicateData.createdBy = req.user.id;
    duplicateData.date = new Date();

    // Generar nuevos _id para subdocumentos
    const duplicate = new Quotation(duplicateData);
    await duplicate.save();

    res.status(201).json({
      success: true,
      data: duplicate,
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
