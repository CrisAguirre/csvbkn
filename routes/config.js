const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/config - Obtener configuración global
router.get('/', async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'global' });
    if (!config) {
      // Crear configuración por defecto con tabla de desperdicios
      config = new Config({
        key: 'global',
        wasteTable: [
          { minMl: 1, maxMl: 10, factor: 0.5 },
          { minMl: 11, maxMl: 30, factor: 0.35 },
          { minMl: 31, maxMl: 50, factor: 0.3 },
          { minMl: 51, maxMl: 100, factor: 0.25 }
        ]
      });
      await config.save();
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/config - Actualizar configuración (solo admin)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.key; // No permitir cambiar la clave

    let config = await Config.findOneAndUpdate(
      { key: 'global' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: config, message: 'Configuración actualizada exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/config/next-number - Obtener y reservar siguiente número de cotización
router.get('/next-number', async (req, res) => {
  try {
    const config = await Config.findOneAndUpdate(
      { key: 'global' },
      { $inc: { nextQuotationNumber: 1 } },
      { new: false } // Retorna el valor ANTES de incrementar
    );
    if (!config) {
      return res.status(500).json({ success: false, message: 'Configuración no encontrada.' });
    }
    res.json({ success: true, data: { number: config.nextQuotationNumber } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
