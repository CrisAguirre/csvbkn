const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'backups', 'backup-2026-09-28_19-34-47.json');
const b = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const quotMap = new Map();
b.quotations.forEach(q => quotMap.set(q._id, q));

const allEntries = [];

// 1. Saved manual entries (registradas en ManualEntry)
b.manualEntries.forEach(m => {
  const q = quotMap.get(m.quotationId);
  allEntries.push({
    origen: 'Cotización Guardada',
    cotizacion: q ? q.number : 'Desconocida',
    cliente: q ? (q.client?.name || 'Sin cliente') : 'Desconocido',
    fecha: m.createdAt ? m.createdAt.substring(0, 10) : '',
    categoria: m.category,
    descripcion: m.description,
    unidad: m.details?.unit || m.details?.unitOfMeasure || 'UNIDAD',
    cantidad: m.details?.quantity ?? 1,
    precioUnitario: m.details?.unitPrice ?? m.details?.laborRate ?? 0,
    precioTotal: m.details?.totalPrice ?? 0,
    detalles: m.details?.apply5Percent ? 'Aplica 5% flete' : (m.details?.timeHours ? `${m.details.timeHours} horas MO` : '')
  });
});

// 2. Temporales (_isManual)
b.temporals.forEach(t => {
  const d = t.data;
  if (!d || !d.areas) return;
  d.areas.forEach(a => {
    (a.furniture || []).forEach(f => {
      ['supplies', 'edgeBands', 'accessories', 'assembly', 'installation'].forEach(cat => {
        (f[cat] || []).forEach(item => {
          if (item._isManual) {
            allEntries.push({
              origen: `Cotización Temporal (${t.currentStepName || 'Borrador'})`,
              cotizacion: `Temporal ID: ${t._id.slice(-6)}`,
              cliente: t.clientName || 'Sin nombre',
              fecha: t.updatedAt ? t.updatedAt.substring(0, 10) : '',
              categoria: cat === 'supplies' ? 'insumo' : cat === 'edgeBands' ? 'canto' : cat === 'accessories' ? 'accesorio' : cat === 'assembly' ? 'armado' : 'instalacion',
              descripcion: item.description || 'Sin descripción',
              unidad: item.unit || item.unitOfMeasure || 'UNIDAD',
              cantidad: item.quantity ?? item.totalQuantity ?? 1,
              precioUnitario: item.unitPrice ?? item.laborRate ?? 0,
              precioTotal: item.totalPrice ?? ((item.quantity ?? 1) * (item.unitPrice ?? 0)),
              detalles: item.apply5Percent ? 'Aplica 5% flete' : (item.timeHours ? `${item.timeHours} horas MO` : '')
            });
          }
        });
      });
    });
  });
});

// 3. Ítems fuera de catálogo en cotizaciones guardadas (operador metió descripción/precio manual que no existe en BD)
const matDesc = new Set(b.materials.map(m => (m.description || '').trim().toLowerCase()));
const laborDesc = new Set(b.laborTimes.map(l => (l.activityName || '').trim().toLowerCase()));
const manualDescs = new Set(b.manualEntries.map(m => m.description.trim().toLowerCase()));

b.quotations.forEach(q => {
  (q.areas || []).forEach(a => {
    (a.furniture || []).forEach(f => {
      ['supplies', 'edgeBands', 'accessories', 'assembly', 'installation'].forEach(cat => {
        (f[cat] || []).forEach(item => {
          const d = (item.description || '').trim().toLowerCase();
          if (!d) return;
          if (!matDesc.has(d) && !laborDesc.has(d) && !manualDescs.has(d)) {
            allEntries.push({
              origen: 'Cotización Guardada (Ítem fuera de BD)',
              cotizacion: q.number,
              cliente: q.client?.name || 'Sin cliente',
              fecha: q.date ? q.date.substring(0, 10) : (q.createdAt?.substring(0, 10) || ''),
              categoria: cat === 'supplies' ? 'insumo' : cat === 'edgeBands' ? 'canto' : cat === 'accessories' ? 'accesorio' : cat === 'assembly' ? 'armado' : 'instalacion',
              descripcion: item.description,
              unidad: item.unit || item.unitOfMeasure || 'UNIDAD',
              cantidad: item.quantity ?? item.totalQuantity ?? 1,
              precioUnitario: item.unitPrice ?? item.laborRate ?? 0,
              precioTotal: item.totalPrice ?? ((item.quantity ?? 1) * (item.unitPrice ?? 0)),
              detalles: item.apply5Percent ? 'Aplica 5% flete' : (item.timeHours ? `${item.timeHours} horas MO` : '')
            });
          }
        });
      });
    });
  });
});

console.log('Total registros exportados:', allEntries.length);

const header = ['Origen', 'Cotizacion', 'Cliente', 'Fecha', 'Categoria', 'Descripcion', 'Unidad', 'Cantidad', 'PrecioUnitario', 'PrecioTotal', 'Detalles'];
const rows = allEntries.map(e => [
  `"${(e.origen || '').replace(/"/g, '""')}"`,
  `"${(e.cotizacion || '').toString().replace(/"/g, '""')}"`,
  `"${(e.cliente || '').replace(/"/g, '""')}"`,
  `"${(e.fecha || '').replace(/"/g, '""')}"`,
  `"${(e.categoria || '').replace(/"/g, '""')}"`,
  `"${(e.descripcion || '').replace(/"/g, '""')}"`,
  `"${(e.unidad || '').replace(/"/g, '""')}"`,
  e.cantidad,
  Math.round(e.precioUnitario),
  Math.round(e.precioTotal),
  `"${(e.detalles || '').replace(/"/g, '""')}"`
].join(';'));

const csvContent = '\uFEFF' + header.join(';') + '\r\n' + rows.join('\r\n');
const outCsv = path.join(__dirname, '..', '..', 'reporte_entradas_manuales_precios.csv');
const outJson = path.join(__dirname, '..', '..', 'reporte_entradas_manuales_precios.json');

fs.writeFileSync(outCsv, csvContent, 'utf8');
fs.writeFileSync(outJson, JSON.stringify(allEntries, null, 2), 'utf8');
console.log('Generados exitosamente:\n' + outCsv + '\n' + outJson);

