/**
 * seed-demo-project.js
 * Crea o actualiza en la base de datos un proyecto completo y concluido,
 * con todas las 7 etapas y sus submódulos diligenciados con datos reales
 * de Spazio Vitale, para que el equipo pueda ver cómo luce un proyecto 100% finalizado.
 */

const API_BASE = process.env.API_URL || 'https://csvbkn.onrender.com/api';

async function main() {
  console.log(`Conectando a backend en: ${API_BASE}...`);

  // 1. Login con cuenta comercial o admin
  const loginCredentials = [
    { email: 'comercial@spaziovitale.com', password: process.env.COMERCIAL_PASSWORD || 'Spazio20261*' },
    { email: 'spaziovitale.gerencia@gmail.com', password: process.env.ADMIN_PASSWORD || 'Spazio2026*' }
  ];

  let token = null;
  let userEmail = null;

  for (const cred of loginCredentials) {
    try {
      console.log(`Intentando login como ${cred.email}...`);
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        // Extraer cookie token si viene en Set-Cookie o si el response lo trae
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
          const match = setCookie.match(/token=([^;]+)/);
          if (match) token = match[1];
        }
        userEmail = data.user.email;
        console.log(`Login exitoso como ${userEmail}`);
        break;
      } else {
        console.warn(`Respuesta login ${cred.email}:`, data.message || res.statusText);
      }
    } catch (err) {
      console.warn(`Fallo login ${cred.email}:`, err.message);
    }
  }

  if (!token) {
    console.error('No se pudo autenticar contra la API. Verifica credenciales o conexión.');
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `token=${token}`,
    'Authorization': `Bearer ${token}`
  };

  // 2. Obtener cotización existente si hay alguna
  let linkedQuotation = null;
  try {
    const qRes = await fetch(`${API_BASE}/quotations?limit=1`, { headers: authHeaders });
    const qData = await qRes.json();
    if (qData.success && qData.data && qData.data.length > 0) {
      linkedQuotation = qData.data[0];
      console.log(`Cotización encontrada para vincular: N° ${linkedQuotation.number} (${linkedQuotation._id})`);
    }
  } catch (err) {
    console.warn('No se pudo consultar cotizaciones previas:', err.message);
  }

  // 3. Estructura completa de datos para el proyecto concluido
  const now = new Date();
  const past = (daysAgo) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const stageDetailsData = {
    inicio: {
      '1.1': { substep: '1.1', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Recepción presencial en sala de ventas. Cliente trajo planos arquitectónicos del apartamento en Altamira.', byEmail: userEmail, at: past(35) },
      '1.2': { substep: '1.2', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Identificado requerimiento: Fabricación a medida de cocina integral con isla + mueble para TV de 75".', byEmail: userEmail, at: past(34) },
      '1.3': { substep: '1.3', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Toma de medidas preliminares y selección de paleta de acabados (Roble Gris y Cuarzo Compac Blanco Zement).', byEmail: 'diseno@spaziovitale.com', at: past(33) },
      '1.4': { substep: '1.4', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Presupuesto de diseño calculado y aprobado por $1.500.000 COP (descontable de la fabricación).', byEmail: 'diseno@spaziovitale.com', at: past(32) },
      '1.5': { substep: '1.5', status: 'completado', responsible: 'contabilidad1@spaziovitale.com', notes: 'Pago de diseño recibido en cuenta Bancolombia. Comprobante N° 849201 verificado.', byEmail: 'contabilidad1@spaziovitale.com', at: past(31) }
    },
    analisis: {
      '2.1': { substep: '2.1', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Modelado 3D fotorrealista y planos de despiece preliminares elaborados con especificaciones técnicas.', byEmail: 'diseno@spaziovitale.com', at: past(30) },
      '2.2': { substep: '2.2', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Presentación de propuesta de diseño al cliente en sala; se aceptaron modulaciones y alturas estándar.', byEmail: userEmail, at: past(29) },
      '2.3': { substep: '2.3', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Stock confirmado con proveedores: Pelícano para tableros, Compac Colombia y herrajes Blum en Durespo.', byEmail: 'diseno@spaziovitale.com', at: past(28) },
      '2.4': { substep: '2.4', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Cotización formal elaborada y vinculada al sistema por un total de $38.450.000 COP con AIU.', byEmail: userEmail, at: past(27) }
    },
    presentacion: {
      '3.1': { substep: '3.1', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Socialización completa de cotización, tiempos de fabricación (20 días hábiles) y condiciones de pago.', byEmail: userEmail, at: past(26) },
      '3.2': { substep: '3.2', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Fichas técnicas de campana isla, cubierta de inducción y torre de hornos integradas en diseño.', byEmail: userEmail, at: past(25) }
    },
    contratacion: {
      '4.1': { substep: '4.1', status: 'completado', responsible: 'contabilidad1@spaziovitale.com', notes: 'Contrato comercial CNT-2026-088 redactado con base en la cotización aprobada.', byEmail: 'contabilidad1@spaziovitale.com', at: past(24) },
      '4.2': { substep: '4.2', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Planos constructivos finales firmados digitalmente para anexo contractual.', byEmail: 'diseno@spaziovitale.com', at: past(23) },
      '4.3': { substep: '4.3', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Firmas recabadas tanto del cliente como de la gerencia de Spazio Vitale SAS.', byEmail: userEmail, at: past(22) },
      '4.4': { substep: '4.4', status: 'completado', responsible: 'contabilidad1@spaziovitale.com', notes: 'Anticipo del 60% ($23.070.000 COP) confirmado en extracto bancario.', byEmail: 'contabilidad1@spaziovitale.com', at: past(21) }
    },
    preparacion: {
      '5.1': { substep: '5.1', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Expediente completo transferido al equipo de diseño técnico y producción.', byEmail: userEmail, at: past(20) },
      '5.2': { substep: '5.2', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Órdenes de compra de melamina, cantos rígidos y mesón COMPAC cargadas en sistema.', byEmail: 'diseno@spaziovitale.com', at: past(19) },
      '5.3': { substep: '5.3', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Revisión y checklist de insumos recibido al 100% en bodega sin inconsistencias.', byEmail: 'diseno@spaziovitale.com', at: past(18) }
    },
    produccion: {
      '6.1': { substep: '6.1', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Planos de ensamble y contrato ingresados a orden de producción en fábrica.', byEmail: userEmail, at: past(17) },
      '6.2': { substep: '6.2', status: 'completado', responsible: 'contabilidad1@spaziovitale.com', notes: 'Seguimiento de despacho de tableros y herrajes Blum; llegada puntual a planta.', byEmail: 'contabilidad1@spaziovitale.com', at: past(16) },
      '6.3': { substep: '6.3', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Programación de cronograma de obra: corte 23-Oct, armado 27-Oct, entrega 05-Nov.', byEmail: userEmail, at: past(15) },
      '6.4': { substep: '6.4', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Rectificación milimétrica en sitio; puntos eléctricos y de gas verificados con instalador.', byEmail: 'diseno@spaziovitale.com', at: past(14) },
      '6.5': { substep: '6.5', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Despiece de optimización de corte y programación CNC finalizados.', byEmail: 'diseno@spaziovitale.com', at: past(12) },
      '6.6': { substep: '6.6', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Corte, enchape de cantos con poliuretano, prearmado y calibración de herrajes concluido en taller.', byEmail: 'diseno@spaziovitale.com', at: past(8) }
    },
    instalacion: {
      '7.1': { substep: '7.1', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Verificación de obra civil: pisos terminados, muros pintados y área despejada para armado.', byEmail: userEmail, at: past(5) },
      '7.2': { substep: '7.2', status: 'completado', responsible: 'diseno@spaziovitale.com', notes: 'Control de calidad en sitio diligenciado: nivelación perfecta de isla y muebles aéreos, sellado COMPAC impecable.', byEmail: 'diseno@spaziovitale.com', at: past(3) },
      '7.3': { substep: '7.3', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Acta de entrega firmada a entera satisfacción. Pago final del saldo ($15.380.000 COP) recibido.', byEmail: userEmail, at: past(2) },
      '7.4': { substep: '7.4', status: 'completado', responsible: 'comercial@spaziovitale.com', notes: 'Manual de mantenimiento de tableros, herrajes y superficie de cuarzo entregado al cliente.', byEmail: userEmail, at: past(1) }
    }
  };

  const projectPayload = {
    title: 'Cocina Integral e Isla Cuarzo COMPAC - Residencia Altamira 402',
    clientName: 'Arq. Roberto Gómez Saldarriaga',
    clientPhone: '+57 314 892 4511',
    clientEmail: 'roberto.gomez@gmail.com',
    clientAddress: 'Cra 43A # 18 Sur - 120, Apto 402, Ed. Altamira, El Poblado, Medellín',
    contactSource: 'recomendacion',
    priority: 'alta',
    currentStage: 'instalacion',
    actors: {
      asesorComercial: 'comercial@spaziovitale.com',
      contadora: 'contabilidad1@spaziovitale.com',
      operarios: ['corte.planta@spaziovitale.com', 'armado.obra@spaziovitale.com'],
      disenador: 'diseno@spaziovitale.com',
      asesorDiseno: 'diseno@spaziovitale.com'
    },
    quotationId: linkedQuotation ? linkedQuotation._id : null,
    quotationRef: linkedQuotation ? String(linkedQuotation.number) : 'COT-2708',
    requirement: 'Diseño, fabricación e instalación de cocina integral moderna con isla central en acabado Cuarzo Compac Blanco Zement y melamina Pelícano Roble Gris, con herrajes Blum de cierre lento, y mueble bajo para TV de 75" en sala.',
    feedback: 'Cliente aprueba la propuesta económica y técnica sin objeciones. Solicita agilizar cronograma para entrega antes del 15 de diciembre.',
    contractNumber: 'CNT-2026-088',
    designStatus: 'aprobado',
    insumosRequested: true,
    insumosNotes: 'Envío de órdenes de compra a Pelícano (tableros roble gris 18mm), COMPAC Colombia (lámina cuarzo blanco zement), y Durespo (herrajes Blum y correderas). Checklist verificado 100% en almacén.',
    productionNotes: 'Fabricación concluida al 100% en taller. Módulos pre-ensamblados, herrajes probados y ajustados. Embalaje con plástico burbuja y esquineros listo para despacho.',

    // Submódulos 1.x
    needType: 'fabricacion',
    designBudget: 1500000,
    designPaymentReceived: true,
    receptionNotes: 'Cliente referido por Constructora Bolívar. Trae planos arquitectónicos y fotografías del espacio en obra gris. Desea diseño premium con isla funcional y espacio para torre de hornos.',

    // Submódulos 2.x
    designElaborationNotes: 'Se elaboraron renders 3D en SketchUp + V-Ray y planos técnicos en AutoCAD. Distribución en L con isla de 2.40m x 1.00m, mesón COMPAC con cascada lateral doble, golas de aluminio negro mate y gavetas tándem Blumotion.',
    designPresentationNotes: 'Socialización presencial en showroom con muestras de melamina y lámina COMPAC. Cliente aprobó la distribución general y seleccionó herrajes Blum Legrabox.',
    materialsConfirmed: true,

    // Submódulos 3.x
    quotationSocializationNotes: 'Presentación formal de la cotización valorada en $38.450.000 COP con desglose AIU e IVA. Se acordaron condiciones de pago 60% anticipo, 35% previo a despacho y 5% a satisfacción.',
    appliancesSocializationNotes: 'Se confirmaron fichas técnicas de campana extractora isla Haceb, cubierta de inducción Teka 4 puestos y torre de hornos Bosch. Medidas de encastre verificadas en planos.',

    // Submódulos 4.x
    contractElaborated: true,
    plansElaborated: true,
    documentsSignedClient: true,
    documentsSignedAdmin: true,
    payment60Received: true,

    // Submódulos 5.x
    designerDocumentSent: true,
    materialsOrderReady: true,
    materialsChecklistDone: true,

    // Submódulos 6.x
    contractPlansSigned: true,
    contractSigned: true,
    appliancesConfirmed: true,
    appliancesNotes: 'Fichas técnicas validadas y cotejadas en fábrica con los despieces de muebles bajos.',
    orderMelamines: true,
    orderEdges: true,
    orderFittings: true,
    orderCountertop: true,
    orderEstimatedArrival: '20-Oct-2026',
    orderFollowupNotes: 'Materiales recibidos completos en bodega central sin novedades de calidad ni faltantes.',
    targetDeliveryDate: '2026-11-04',
    measurementsRectificationDate: '2026-10-22',
    mepPlansReady: true,
    cuttingListScheduled: true,
    productionTasksScheduled: true,
    estimatedCompletionDate: '2026-11-02',
    mepPlansVerifiedOnSite: true,
    rectificationNotes: 'Rectificación realizada en sitio por jefe de producción. Desviación de 8mm en muro posterior corregida en despiece. Puntos de agua y desagüe alineados.',
    cutAndEdgePlansDone: true,
    assemblyPlansDone: true,
    materialsAvailabilityVerified: true,
    cuttingDone: true,
    edgingDone: true,
    assemblyDone: true,
    fittingsInstalled: true,
    workshopCompletionDone: true,

    // Submódulos 7.x
    civilWorkFinished: true,
    civilWorkNotes: 'Pisos en porcelanato instalados y protegidos, muros estucados y con primera mano de pintura. Conexiones eléctricas a 220V listas.',
    qualityControlFormSigned: true,
    qualityControlNotes: 'Control de calidad aprobado. Instalación ejecutada en 2 jornadas completas por cuadrilla de operarios. Nivelación milimétrica y sellado perimetral con silicona neutra.',
    deliveryFormSigned: true,
    deliveryDate: '2026-11-05',
    finalAmount: 38450000,
    finalPaymentReceived: true,
    deliveryNotes: 'Acta de entrega firmada a entera satisfacción por el Arq. Roberto Gómez. Saldo cancelado mediante transferencia bancaria.',
    maintenanceManualDelivered: true,
    customerFollowupNotes: 'Se entregó cartilla física y digital de cuidado para melaminas y superficies COMPAC. Contacto de garantía a 1 año registrado. Cliente muy satisfecho con los acabados.',

    stageDetails: stageDetailsData,
    notes: 'Proyecto modelo de referencia 100% concluido. Contiene todas las etapas y submódulos diligenciados.'
  };

  console.log('Enviando creación del proyecto modelo a la API...');
  const createRes = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(projectPayload)
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.success) {
    console.error('Error al crear proyecto:', createData);
    process.exit(1);
  }

  const createdId = createData.data._id;
  console.log(`Proyecto creado exitosamente con ID: ${createdId}`);

  // 4. Marcar la etapa final 'instalacion' como completada mediante PATCH /stage-state
  console.log('Marcando etapa final "instalación" como completada...');
  const patchStateRes = await fetch(`${API_BASE}/projects/${createdId}/stage-state`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      stage: 'instalacion',
      status: 'completado',
      notes: 'Proyecto concluido al 100% con entrega formal a satisfacción del cliente y garantía activa.'
    })
  });
  const patchData = await patchStateRes.json();
  console.log('Resultado de actualización de estado:', patchData.message || patchData);

  // 5. Asegurar que stageDetails y campos de todas las etapas queden persistidos
  console.log('Actualizando stageDetails completos...');
  const updateRes = await fetch(`${API_BASE}/projects/${createdId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      ...projectPayload,
      currentStage: 'instalacion'
    })
  });
  const updateData = await updateRes.json();
  console.log('Resultado final:', updateData.message || updateData);

  console.log('\n======================================================');
  console.log('¡PROYECTO MODELO CREADO CON ÉXITO!');
  console.log(`ID: ${createdId}`);
  console.log(`Título: ${projectPayload.title}`);
  console.log(`Cliente: ${projectPayload.clientName}`);
  console.log(`Etapa: ${projectPayload.currentStage} (Completada 100%)`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

