const express = require('express');
const router = express.Router();
const Temporal = require('../models/Temporal');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Obtener todas las cotizaciones temporales (visible para todos, con autor)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Ordenar de más reciente a más antigua
    const temporals = await Temporal.find()
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'email role');
    res.json({ success: true, data: temporals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener una cotización temporal por ID (visible para todos)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const temporal = await Temporal.findById(req.params.id).populate('createdBy', 'email role');
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
      // Intentar actualizar: solo dueño o admin (los legacy sin creador los puede tomar cualquiera)
      const existing = await Temporal.findById(_id);
      if (existing) {
        const ownerId = existing.createdBy?._id?.toString?.() || existing.createdBy?.toString?.();
        if (ownerId && ownerId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'No tiene permisos para editar este temporal de otro usuario. Duplíquelo como cotización si lo necesita.' });
        }
        existing.clientName = clientName ?? existing.clientName;
        existing.currentStepName = currentStepName ?? existing.currentStepName;
        existing.currentStepNumber = currentStepNumber ?? existing.currentStepNumber;
        existing.data = data ?? existing.data;
        // Si era legacy sin autor, asignar al que lo retoma
        if (!existing.createdBy) {
          existing.createdBy = req.user.id;
          existing.createdByEmail = req.user.email || '';
        }
        const updated = await existing.save();
        await updated.populate('createdBy', 'email role');
        return res.json({ success: true, data: updated });
      }
    }
    
    // Si no tiene ID o no se encontró, crear uno nuevo con autor
    const newTemporal = new Temporal({
      clientName, currentStepName, currentStepNumber, data,
      createdBy: req.user.id,
      createdByEmail: req.user.email || ''
    });
    const saved = await newTemporal.save();
    await saved.populate('createdBy', 'email role');
    res.status(201).json({ success: true, data: saved });
    
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Eliminar TODAS las cotizaciones temporales (limpieza, solo admin)
router.delete('/all/cleanup', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await Temporal.deleteMany({});
    res.json({ success: true, message: `${result.deletedCount} temporales eliminados` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eliminar una cotización temporal (solo dueño o admin; legacy sin autor lo puede borrar cualquiera autenticado)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const temporal = await Temporal.findById(req.params.id);
    if (!temporal) {
      return res.status(404).json({ success: false, message: 'Temporal no encontrado' });
    }
    const ownerId = temporal.createdBy?._id?.toString?.() || temporal.createdBy?.toString?.();
    if (ownerId && ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No tiene permisos para eliminar este temporal de otro usuario.' });
    }
    await temporal.deleteOne();
    res.json({ success: true, message: 'Temporal eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
