const express = require('express');
const router = express.Router();
const LaborTime = require('../models/LaborTime');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/labor-times - Listar actividades
router.get('/', async (req, res) => {
  try {
    const { search, active, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (active !== undefined) filter.active = active === 'true';
    if (search) {
      filter.$or = [
        { activityName: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [laborTimes, total] = await Promise.all([
      LaborTime.find(filter).sort({ activityName: 1 }).skip(skip).limit(parseInt(limit)),
      LaborTime.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: laborTimes,
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

// GET /api/labor-times/:id - Obtener uno
router.get('/:id', async (req, res) => {
  try {
    const laborTime = await LaborTime.findById(req.params.id);
    if (!laborTime) {
      return res.status(404).json({ success: false, message: 'Actividad no encontrada.' });
    }
    res.json({ success: true, data: laborTime });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/labor-times - Crear (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const laborTime = new LaborTime(req.body);
    await laborTime.save();
    res.status(201).json({ success: true, data: laborTime, message: 'Actividad creada exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/labor-times/:id - Actualizar (solo admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const laborTime = await LaborTime.findById(req.params.id);
    if (!laborTime) {
      return res.status(404).json({ success: false, message: 'Actividad no encontrada.' });
    }

    Object.assign(laborTime, req.body);
    await laborTime.save();
    res.json({ success: true, data: laborTime, message: 'Actividad actualizada exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/labor-times/:id - Eliminar (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const laborTime = await LaborTime.findByIdAndDelete(req.params.id);
    if (!laborTime) {
      return res.status(404).json({ success: false, message: 'Actividad no encontrada.' });
    }
    res.json({ success: true, message: 'Actividad eliminada exitosamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/labor-times/bulk-upsert - Crear o actualizar por code (solo admin)
router.post('/bulk-upsert', requireAdmin, async (req, res) => {
  try {
    const { items, replaceAll } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere un array de items.' });
    }

    if (replaceAll) {
      await LaborTime.deleteMany({});
    }

    let created = 0;
    let updated = 0;

    for (const raw of items) {
      const payload = {
        code: String(raw.code || '').trim(),
        activityName: String(raw.activityName || '').trim(),
        timeHours: Number(raw.timeHours) || 0,
        category: raw.category || '',
        minutes: Number(raw.minutes) || 0,
        valorMinuto: Number(raw.valorMinuto) || 0,
        persons: Number(raw.persons) || 1,
        quantity: Number(raw.quantity) || 1,
        unit: raw.unit || 'UNIDAD',
        isService: raw.isService === true,
        notes: raw.notes || '',
        active: raw.active !== false
      };

      if (!payload.code || !payload.activityName) continue;

      const existing = await LaborTime.findOne({ code: payload.code });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updated++;
      } else {
        await LaborTime.create(payload);
        created++;
      }
    }

    res.json({
      success: true,
      message: `Importación: ${created} nuevos, ${updated} actualizados.`,
      data: { created, updated, total: created + updated }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
