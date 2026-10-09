// Flujo secuencial del monitor de Proyectos (local comercial Spazio Vitale).
// Etapas: 1 inicio, 2 analisis, 3 presentacion, 4 contratacion, 5 preparacion, 6 produccion, 7 instalacion.
// Actores del proceso: asesor comercial, contadora, operarios, disenador, asesor diseno, cliente.
const STAGES = ['inicio', 'analisis', 'presentacion', 'contratacion', 'preparacion', 'produccion', 'instalacion'];

const STAGE_LABELS = {
  inicio: '1. Inicio',
  analisis: '2. Análisis',
  presentacion: '3. Presentación',
  contratacion: '4. Contratación',
  preparacion: '5. Preparación',
  produccion: '6. Producción',
  instalacion: '7. Instalación'
};

// Actor responsable principal por etapa (etiquetas ES del negocio).
const STAGE_ACTORS = {
  inicio: ['asesor_comercial'],
  analisis: ['asesor_comercial', 'disenador', 'asesor_diseno'],
  presentacion: ['asesor_comercial', 'cliente'],
  contratacion: ['contadora', 'asesor_comercial'],
  preparacion: ['disenador', 'operarios'],
  produccion: ['operarios'],
  instalacion: ['operarios']
};

// Mapeo rol de sistema -> actores que puede mover.
// admin lo puede todo. comercial=asesor_comercial, contabilidad=contadora, diseno=disenador+asesor_diseno.
// operarios no existe como rol de sistema: lo cubren admin y diseno en v1.
const ROLE_ACTORS = {
  admin: ['asesor_comercial', 'contadora', 'operarios', 'disenador', 'asesor_diseno', 'cliente'],
  comercial: ['asesor_comercial', 'cliente'],
  contabilidad: ['contadora'],
  diseno: ['disenador', 'asesor_diseno', 'operarios']
};

// Caracteristicas de cada etapa (definidas por negocio local comercial).
const STAGE_DETAILS = {
  inicio: {
    title: '1. Inicio',
    description: 'Contacto con el cliente y definicion del requerimiento o necesidad.',
    checklist: ['Registrar medio de contacto (redes/almacen/recomendacion/antiguo)', 'Definir requerimiento o necesidad', 'Asignar asesor comercial'],
    exitRequires: ['requirement']
  },
  analisis: {
    title: '2. Análisis',
    description: 'Se genera la cotizacion del proyecto.',
    checklist: ['Generar cotizacion en modulo Cotizaciones', 'Vincular cotizacion al proyecto (ID o ref)'],
    exitRequires: ['quotation']
  },
  presentacion: {
    title: '3. Presentación',
    description: 'Se socializa el proyecto con el cliente y se recibe retroalimentacion. Con aprobacion avanza a Contratacion; con ajustes vuelve a Analisis a regenerar cotizacion.',
    checklist: ['Socializar propuesta con cliente', 'Registrar retroalimentacion (feedback)', 'Decidir: aprobar a Contratacion o devolver a Analisis'],
    exitRequires: ['feedback'],
    allowsBackToAnalisis: true
  },
  contratacion: {
    title: '4. Contratación',
    description: 'Se genera el contrato y los planos/disenos.',
    checklist: ['Generar contrato (numero)', 'Elaborar planos y disenos', 'Aprobar disenos'],
    exitRequires: ['contractNumber', 'designApproved']
  },
  preparacion: {
    title: '5. Preparación',
    description: 'Se solicitan insumos y se hacen preparaciones varias antes de iniciar la obra.',
    checklist: ['Solicitar insumos', 'Registrar preparaciones varias', 'Verificar stock/medidas'],
    exitRequires: ['insumos']
  },
  produccion: {
    title: '6. Producción',
    description: 'Se procede a la fabricacion.',
    checklist: ['Fabricar', 'Control de calidad', 'Registrar notas de produccion'],
    exitRequires: ['productionNotes']
  },
  instalacion: {
    title: '7. Instalación',
    description: 'Paso final: se entrega la obra y se recibe el pago final.',
    checklist: ['Instalar y entregar obra', 'Registrar fecha de entrega', 'Recibir pago final'],
    exitRequires: ['delivery']
  }
};

// Estado en tiempo real por cada uno de los 7 pasos (todos los actores lo ven).
// pendiente: no inicia · en_curso: etapa actual · completado: terminada
// devuelto: devuelta a reproceso · bloqueado: pausada (solo admin bloquea/desbloquea)
const STAGE_STATES = ['pendiente', 'en_curso', 'completado', 'devuelto', 'bloqueado'];

const STAGE_STATE_LABELS = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completado: 'Completado',
  devuelto: 'Devuelto',
  bloqueado: 'Bloqueado'
};

function initialStageStates(currentStage, userEmail) {
  const now = new Date();
  const states = {};
  const idx = stageIndex(currentStage || 'inicio');
  STAGES.forEach((s, i) => {
    states[s] = {
      status: i < idx ? 'completado' : (i === idx ? 'en_curso' : 'pendiente'),
      updatedAt: now,
      updatedByEmail: userEmail || '',
      notes: i === idx ? 'Proyecto creado' : ''
    };
  });
  return states;
}

// Recalcula stageStates ante un movimiento from -> to.
// - Avance (j>i): from=completado, to=en_curso (limpia devuelto/bloqueado previo de to).
// - Retroceso (j<i): from=devuelto, to=en_curso, intermedias=pendiente.
// - Mismo: no cambia.
function computeStageStatesOnTransition(prevStates, from, to, userEmail, notes) {
  const i = stageIndex(from);
  const j = stageIndex(to);
  const now = new Date();
  const states = {};
  STAGES.forEach((s) => {
    states[s] = { ...(prevStates?.[s] || { status: 'pendiente', updatedAt: now, updatedByEmail: '', notes: '' }) };
  });
  if (i === j) return states;
  if (j > i) {
    states[from] = { status: 'completado', updatedAt: now, updatedByEmail: userEmail || '', notes: notes || '' };
    states[to] = { status: 'en_curso', updatedAt: now, updatedByEmail: userEmail || '', notes: '' };
  } else {
    states[from] = { status: 'devuelto', updatedAt: now, updatedByEmail: userEmail || '', notes: notes || 'Devuelto a reproceso' };
    states[to] = { status: 'en_curso', updatedAt: now, updatedByEmail: userEmail || '', notes: '' };
    // Etapas intermedias entre to y from quedan pendientes de rehacer
    STAGES.forEach((s, k) => {
      if (k > j && k < i) states[s] = { status: 'pendiente', updatedAt: now, updatedByEmail: userEmail || '', notes: '' };
    });
  }
  return states;
}
function missingExitRequirements(from, project, notes) {
  const p = project || {};
  const hasQuotation = !!(p.quotationId || p.quotationRef);
  switch (from) {
    case 'inicio':
      if (!(p.requirement && String(p.requirement).trim())) return ['requirement: define el requerimiento o necesidad (etapa 1)'];
      return [];
    case 'analisis':
      if (!hasQuotation) return ['quotation: genera y vincula la cotizacion (etapa 2)'];
      return [];
    case 'presentacion':
      // Retroalimentacion obligatoria tanto para avanzar como para devolver
      if (!((notes && String(notes).trim()) || (p.feedback && String(p.feedback).trim()))) {
        return ['feedback: registra la retroalimentacion del cliente (etapa 3)'];
      }
      return [];
    case 'contratacion':
      if (!(p.contractNumber && String(p.contractNumber).trim())) return ['contractNumber: genera el contrato (etapa 4)'];
      if (p.designStatus !== 'aprobado') return ['designStatus: aprueba planos/disenos (etapa 4)'];
      return [];
    case 'preparacion':
      if (!p.insumosRequested) return ['insumosRequested: solicita los insumos (etapa 5)'];
      return [];
    case 'produccion':
      if (!(p.productionNotes && String(p.productionNotes).trim())) return ['productionNotes: registra la fabricacion (etapa 6)'];
      return [];
    case 'instalacion':
      return [];
    default:
      return [];
  }
}

function stageIndex(stage) {
  return STAGES.indexOf(stage);
}

// Transicion secuencial: solo +/-1 salvo admin que puede saltar.
// Retroceder se permite (reproceso) solo 1 paso para no-auth admin.
function isValidTransition(from, to, isAdmin) {
  const i = stageIndex(from);
  const j = stageIndex(to);
  if (i === -1 || j === -1) return false;
  if (i === j) return true;
  if (isAdmin) return true;
  return Math.abs(j - i) === 1;
}

function canRoleMoveStage(role, stage) {
  if (role === 'admin') return true;
  const allowed = ROLE_ACTORS[role] || [];
  const responsibles = STAGE_ACTORS[stage] || [];
  return responsibles.some((a) => allowed.includes(a));
}

module.exports = { STAGES, STAGE_LABELS, STAGE_ACTORS, ROLE_ACTORS, STAGE_DETAILS, STAGE_STATES, STAGE_STATE_LABELS, stageIndex, isValidTransition, canRoleMoveStage, missingExitRequirements, initialStageStates, computeStageStatesOnTransition };
