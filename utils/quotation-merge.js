/**
 * Fusión de cotizaciones del mismo cliente creadas en una ventana de 7 días.
 * El resultado es UNA cotización nueva y consolidada; no se duplican las
 * cotizaciones de origen ni se imprimen sus números en el PDF.
 */

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dateOf(quotation) {
  const d = new Date(quotation.date || quotation.createdAt || Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function withinDays(a, b, days = WINDOW_DAYS) {
  const diff = Math.abs(dateOf(a).getTime() - dateOf(b).getTime());
  return diff <= days * DAY_MS;
}

/** Cotizaciones compatibles con la objetivo: mismo cliente y ±7 días. */
function compatibleCandidates(target, quotations, days = WINDOW_DAYS) {
  if (!target) return [];
  const name = norm(target.client?.name);
  return (quotations || []).filter((q) =>
    q._id?.toString() !== target._id?.toString() &&
    norm(q.client?.name) === name &&
    withinDays(q, target, days)
  );
}

const ITEM_LISTS = [
  'supplies', 'edgeBands', 'designTime', 'accessories',
  'assembly', 'installation', 'veneer'
];

function mergeFurniture(dest, src) {
  dest.quantity = (Number(dest.quantity) || 0) + (Number(src.quantity) || 0);
  ITEM_LISTS.forEach((key) => {
    if (src[key]?.length) {
      dest[key] = [...(dest[key] || []), ...clone(src[key])];
    }
  });
  if (src.mesonDetails && !dest.mesonDetails) dest.mesonDetails = clone(src.mesonDetails);
}

function mergeArea(dest, src) {
  for (const furn of src.furniture || []) {
    const key = `${norm(furn.name)}|${norm(furn.type)}`;
    const existing = (dest.furniture || []).find((f) => `${norm(f.name)}|${norm(f.type)}` === key);
    if (existing) mergeFurniture(existing, furn);
    else dest.furniture.push(clone(furn));
  }
  if (src.visibleAccessories?.length) {
    dest.visibleAccessories = [...(dest.visibleAccessories || []), ...clone(src.visibleAccessories)];
  }
  if (src.subAreas?.length) {
    dest.subAreas = [...(dest.subAreas || []), ...clone(src.subAreas)];
  }
}

/** Construye los datos de la cotización consolidada (aún con number/status por asignar). */
function mergeQuotations(target, sources) {
  const all = [target, ...sources].map(clone);
  const base = all[0];

  const areas = [];
  const areaMap = new Map();
  for (const q of all) {
    for (const area of q.areas || []) {
      const key = norm(area.name);
      if (areaMap.has(key)) {
        mergeArea(areaMap.get(key), area);
      } else {
        const copy = clone(area);
        copy.furniture = copy.furniture || [];
        areaMap.set(key, copy);
        areas.push(copy);
      }
    }
  }

  const products = all.flatMap((q) => q.products || []).map(clone);
  const designs = all.flatMap((q) => q.designs || []).map(clone);

  return {
    ...base,
    _id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    __v: undefined,
    createdBy: undefined,
    createdByEmail: undefined,
    presentedAt: undefined,
    presentedBy: undefined,
    version: undefined,
    versionHistory: undefined,
    areas,
    products,
    designs,
    // Auditoría interna: NO se imprime en el PDF.
    mergedFrom: all.map((q) => ({
      quotationId: q._id,
      number: q.number,
      date: q.date,
      clientName: q.client?.name || ''
    })),
    notes: `Cotización consolidada de ${all.length} cotizaciones del mismo cliente.`,
    status: 'borrador'
  };
}

module.exports = {
  WINDOW_DAYS,
  withinDays,
  compatibleCandidates,
  mergeQuotations
};
