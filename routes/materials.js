const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/materials - Listar materiales (con filtros)
router.get('/', async (req, res) => {
  try {
    const { category, search, active, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (category) filter.category = category;
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
    const [materials, total] = await Promise.all([
      Material.find(filter).sort({ category: 1, description: 1 }).skip(skip).limit(parseInt(limit)),
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
