const express = require('express');
const router = express.Router();
const Temporal = require('../models/Temporal');
const { authMiddleware } = require('../middleware/auth');

// Obtener todas las cotizaciones temporales
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Ordenar de más reciente a más antigua
    const temporals = await Temporal.find().sort({ updatedAt: -1 });
    res.json({ success: true, data: temporals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener una cotización temporal por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const temporal = await Temporal.findById(req.params.id);
    if (!temporal) {
      return res.status(404).json({ success: false, message: 'Temporal no encontrado' });
    }
    res.json({ success: true, data: temporal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Crear o actualizar una cotización temporal (usando PUT para idempotencia si se manda el ID en body, o POST si es nueva)
// En este caso, usaremos POST y la lógica decidirá si crear o actualizar.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { _id, clientName, currentStepName, currentStepNumber, data } = req.body;
    
    if (_id && _id !== 'new') {
      // Intentar actualizar
      const updated = await Temporal.findByIdAndUpdate(
        _id,
        { clientName, currentStepName, currentStepNumber, data },
        { new: true }
      );
      if (updated) {
        return res.json({ success: true, data: updated });
      }
    }
    
    // Si no tiene ID o no se encontró, crear uno nuevo
    const newTemporal = new Temporal({
      clientName, currentStepName, currentStepNumber, data
    });
    const saved = await newTemporal.save();
    res.status(201).json({ success: true, data: saved });
    
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Eliminar una cotización temporal
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const temporal = await Temporal.findByIdAndDelete(req.params.id);
    if (!temporal) {
      return res.status(404).json({ success: false, message: 'Temporal no encontrado' });
    }
    res.json({ success: true, message: 'Temporal eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
