const express = require('express');
const router = express.Router();
const ManualEntry = require('../models/ManualEntry');
const { authMiddleware } = require('../middleware/auth');

// GET /api/manual-entries - Obtener lista de registros manuales
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      ManualEntry.find(query)
        .populate('quotationId', 'documentId clientName')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      ManualEntry.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching manual entries:', error);
    res.status(500).json({ success: false, error: 'Error al obtener registros manuales' });
  }
});

// DELETE /api/manual-entries/:id - Eliminar un registro si ya no se necesita
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const entry = await ManualEntry.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Registro no encontrado' });
    }
    res.json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting manual entry:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar el registro' });
  }
});

module.exports = router;
