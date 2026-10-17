const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { projectSchema, updateProjectStageSchema, updateStageStateSchema, updateProjectStepSchema } = require('../utils/schemas');
const { isValidTransition, missingExitRequirements, initialStageStates, computeStageStatesOnTransition, canRoleMoveStage } = require('../utils/projectFlow');

function sanitizeProjectInput(body) {
  const data = { ...body };
  if (data.quotationId === '' || data.quotationId === undefined) delete data.quotationId;
  if (data.deliveryDate === '' || data.deliveryDate === undefined) delete data.deliveryDate;
  return data;
}

// Todas las rutas requieren autenticación (lectura global, como quotations/temporals)
router.use(authMiddleware);

// GET /api/projects - Listar con filtros
router.get('/', async (req, res) => {
  try {
    const { search, stage, contactSource, active, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (stage) filter.currentStage = stage;
    if (contactSource) filter.contactSource = contactSource;
    if (active !== undefined) filter.active = active === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [projects, total] = await Promise.all([
      Project.find(filter).populate('createdBy', 'email role').sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit)),
      Project.countDocuments(filter)
    ]);
    res.json({ success: true, data: projects, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'email role').populate('quotationId', 'number client');
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/projects - Crear (cualquier autenticado)
router.post('/', validate(projectSchema), async (req, res) => {
  try {
    const clean = sanitizeProjectInput(req.body);
    const payload = { ...clean, createdBy: req.user.id, createdByEmail: req.user.email || '' };
    const project = new Project(payload);
    // Estado inicial en tiempo real: etapa actual en_curso, resto pendiente
    project.stageStates = initialStageStates(project.currentStage || 'inicio', req.user.email);
    // Historial inicial
    project.stageHistory = [{
      stage: project.currentStage || 'inicio',
      changedBy: req.user.id,
      changedByEmail: req.user.email || '',
      changedAt: new Date(),
      notes: 'Proyecto creado'
    }];
    await project.save();
    res.status(201).json({ success: true, data: project, message: 'Proyecto creado exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/projects/:id - Actualizar datos (cualquier autenticado; createdBy se preserva)
router.put('/:id', validate(projectSchema), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    const isAdmin = req.user.role === 'admin';
    const clean = sanitizeProjectInput(req.body);
    // Campos sensibles bloqueados para no-admin una vez diligenciados
    if (!isAdmin) {
      const locked = ['contractNumber', 'designStatus', 'documentsSignedClient', 'documentsSignedAdmin', 'payment60Received', 'finalPaymentReceived', 'deliveryDate'];
      for (const f of locked) {
        const cur = project[f];
        const isSet = (typeof cur === 'boolean') ? cur === true : !!cur;
        if (isSet && Object.prototype.hasOwnProperty.call(clean, f)) {
          delete clean[f];
        }
      }
    }
    // Cambio de etapa via PUT también valida secuencia + puertas de salida
    if (clean.currentStage && clean.currentStage !== project.currentStage) {
      if (!isValidTransition(project.currentStage, clean.currentStage, isAdmin)) {
        return res.status(403).json({ success: false, message: 'Transición de etapa no secuencial. Solo el admin puede saltar etapas.' });
      }
      const missing = missingExitRequirements(project.currentStage, { ...project.toObject(), ...clean }, clean.stageNotes || clean.feedback || clean.notes);
      if (missing.length > 0) {
        return res.status(400).json({ success: false, message: 'Faltan requisitos de la etapa actual: ' + missing.join('; '), errors: missing.map((m) => ({ field: 'stage', message: m })) });
      }
      if (clean.feedback || clean.stageNotes) project.feedback = clean.feedback || clean.stageNotes || project.feedback;
      const motionNotesPut = clean.stageNotes || clean.feedback || 'Etapa actualizada';
      project.stageStates = computeStageStatesOnTransition(
        project.stageStates ? (project.toObject().stageStates || {}) : {},
        project.currentStage,
        clean.currentStage,
        req.user.email,
        motionNotesPut
      );
      project.stageHistory.push({
        stage: clean.currentStage,
        changedBy: req.user.id,
        changedByEmail: req.user.email || '',
        changedAt: new Date(),
        notes: motionNotesPut
      });
    }
    const updateData = { ...clean };
    delete updateData.createdBy;
    delete updateData.createdByEmail;
    delete updateData.stageHistory;
    delete updateData.stageStates;
    Object.assign(project, updateData);
    await project.save();
    res.json({ success: true, data: project, message: 'Proyecto actualizado exitosamente.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/projects/:id/stage - Avanzar/retroceder etapa secuencial con puertas por etapa
router.patch('/:id/stage', validate(updateProjectStageSchema), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    const isAdmin = req.user.role === 'admin';
    const { stage, notes, feedback } = req.body;
    if (!isValidTransition(project.currentStage, stage, isAdmin)) {
      return res.status(403).json({ success: false, message: 'Transición de etapa no secuencial. Avanza o retrocede de a 1 paso (presentación puede volver a análisis o avanzar a contratación).' });
    }
    const motionNotes = notes || feedback || '';
    const missing = missingExitRequirements(project.currentStage, project, motionNotes);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: 'Faltan requisitos de la etapa actual: ' + missing.join('; '), errors: missing.map((m) => ({ field: 'stage', message: m })) });
    }
    // Persistir retroalimentación de presentación (avance o devolución)
    if (project.currentStage === 'presentacion' && motionNotes) {
      project.feedback = motionNotes;
    }
    const fromStage = project.currentStage;
    project.stageStates = computeStageStatesOnTransition(
      project.toObject().stageStates || {},
      fromStage,
      stage,
      req.user.email,
      motionNotes
    );
    project.currentStage = stage;
    project.stageHistory.push({
      stage,
      changedBy: req.user.id,
      changedByEmail: req.user.email || '',
      changedAt: new Date(),
      notes: motionNotes || ''
    });
    await project.save();
    res.json({ success: true, data: project, message: `Proyecto movido a ${stage}.` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/projects/:id/stage-state - Marcar estado de un paso (bloqueado/devuelto/pendiente). Solo admin bloquea.
router.patch('/:id/stage-state', validate(updateStageStateSchema), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    const { stage, status, notes } = req.body;
    if (status === 'bloqueado' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el admin puede bloquear etapas.' });
    }
    const current = project.stageStates?.[stage] || {};
    project.stageStates[stage] = {
      status,
      updatedAt: new Date(),
      updatedByEmail: req.user.email || '',
      notes: notes || current.notes || ''
    };
    project.markModified('stageStates');
    project.stageHistory.push({
      stage,
      changedBy: req.user.id,
      changedByEmail: req.user.email || '',
      changedAt: new Date(),
      notes: `Estado ${stage} → ${status}${notes ? ': ' + notes : ''}`
    });
    await project.save();
    res.json({ success: true, data: project, message: `Paso ${stage} marcado como ${status}.` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/projects/:id/step - Actualizar detalle de un subpaso (informacion tecnica en tiempo real)
router.patch('/:id/step', validate(updateProjectStepSchema), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    const { stage, substep, status, responsible, notes, kind, reason } = req.body;
    // Permiso por rol para editar pasos de la etapa
    if (!canRoleMoveStage(req.user.role, stage) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta etapa.' });
    }
    if (!stage) return res.status(400).json({ success: false, message: 'Etapa requerida.' });

    // Actualizar stageDetails[stage][substep]
    const details = project.stageDetails && typeof project.stageDetails === 'object' ? { ...project.stageDetails } : {};
    if (!details[stage]) details[stage] = {};
    const key = substep || '_general';
    const prev = details[stage][key] || {};
    details[stage][key] = {
      ...prev,
      substep: substep || '',
      status: status || prev.status || 'pendiente',
      responsible: responsible !== undefined && responsible !== null ? responsible : (prev.responsible || ''),
      notes: notes !== undefined && notes !== null ? notes : (prev.notes || ''),
      kind: kind || prev.kind || 'normal',
      reason: reason !== undefined && reason !== null ? reason : (prev.reason || ''),
      byEmail: req.user.email || '',
      byRole: req.user.role || '',
      updatedAt: new Date()
    };
    project.stageDetails = details;
    project.markModified('stageDetails');

    // Append to stepUpdates timeline (mantener ultimos 200)
    const updates = Array.isArray(project.stepUpdates) ? [...project.stepUpdates] : [];
    updates.push({
      stage,
      substep: substep || '',
      status: status || 'pendiente',
      responsible: responsible || '',
      notes: notes || '',
      kind: kind || 'normal',
      reason: reason || '',
      byEmail: req.user.email || '',
      byRole: req.user.role || '',
      at: new Date()
    });
    if (updates.length > 200) updates.splice(0, updates.length - 200);
    project.stepUpdates = updates;

    await project.save();
    res.json({ success: true, data: project, message: 'Paso actualizado.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/projects/:id - Solo admin
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    res.json({ success: true, message: 'Proyecto eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
