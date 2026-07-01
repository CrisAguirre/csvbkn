const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/materials - Listar materiales (con filtros)
router.get('/', async (req, res) => {
  try {
    const { category, search, active, page = 1, limit = 50, sort } = req.query;
    const filter = {};

    if (category) {
      if (category.includes(',')) {
        filter.category = { $in: category.split(',').map(c => c.trim()) };
      } else {
        filter.category = category;
      }
    }
    if (active !== undefined) filter.active = active === 'true';
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } },
        { color: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sortObj = { category: 1, description: 1 };
    if (sort) {
      sortObj = sort; // Expecting a string like "price" or "-price", mongoose handles string sorts
    }

    const [materials, total] = await Promise.all([
      Material.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
      Material.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: materials,
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

// POST /api/materials/bulk-upsert - Crear o actualizar por code + provider (solo admin)
router.post('/bulk-upsert', requireAdmin, async (req, res) => {
  try {
    const { materials, replaceProvider } = req.body;
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere un array de materiales.' });
    }

    if (replaceProvider) {
      await Material.deleteMany({ provider: replaceProvider });
    }

    let created = 0;
    let updated = 0;

    for (const raw of materials) {
      const payload = {
        category: raw.category || 'otro',
        code: String(raw.code || '').trim(),
        description: String(raw.description || '').trim(),
        provider: String(raw.provider || '').trim(),
        color: raw.color || '',
        dimension: raw.dimension || '',
        unit: raw.unit || 'UNIDAD',
        unitPrice: Number(raw.unitPrice) || 0,
        pricePerSheet: Number(raw.pricePerSheet) || 0,
        measure1: Number(raw.measure1) || 0,
        measure2: Number(raw.measure2) || 0,
        active: raw.active !== false
      };

      if (!payload.code || !payload.description || !payload.provider) continue;

      const existing = await Material.findOne({ code: payload.code, provider: payload.provider });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updated++;
      } else {
        await Material.create(payload);
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

// GET /api/materials/:id - Obtener material por ID
router.get('/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material no encontrado.' });
    }
    res.json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/materials - Crear material (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const material = new Material(req.body);
    await material.save();
    res.status(201).json({ success: true, data: material, message: 'Material creado exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/materials/:id - Actualizar material (solo admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material no encontrado.' });
    }

    Object.assign(material, req.body);
    await material.save(); // Triggers pre-save for melamina calculations
    res.json({ success: true, data: material, message: 'Material actualizado exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/materials/:id - Eliminar material (solo admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material no encontrado.' });
    }
    res.json({ success: true, message: 'Material eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/materials/bulk - Carga masiva (solo admin)
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { materials } = req.body;
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere un array de materiales.' });
    }
    const result = await Material.insertMany(materials, { ordered: false });
    res.status(201).json({
      success: true,
      message: `${result.length} materiales creados exitosamente.`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
