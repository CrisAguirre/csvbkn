/**
 * Los herrajes (furniture.accessories) no muestran precios a usuarios no-admin.
 * La redacción se hace en el SERVIDOR para que ni la API ni el PDF (que se genera
 * en el cliente a partir de la API) puedan filtrarlos.
 *
 * Para que un no-admin pueda seguir editando cantidades sin destruir precios,
 * el servidor conserva las bases de precio originales antes de recalcular.
 */

const PRICE_FIELDS = ['unitPrice', 'totalPrice', 'laborRate', 'totalWithTax'];
const BASE_FIELDS = ['unitPrice', 'laborRate'];

function eachAccessory(quotation, fn) {
  const areas = quotation.areas || [];
  for (let a = 0; a < areas.length; a++) {
    const furniture = areas[a].furniture || [];
    for (let f = 0; f < furniture.length; f++) {
      const accessories = furniture[f].accessories || [];
      for (let i = 0; i < accessories.length; i++) {
        fn(accessories[i], a, f, i);
      }
    }
  }
}

/** Devuelve una copia sin precios en herrajes (no muta el documento original). */
function redactHardwarePrices(quotation) {
  const obj = typeof quotation.toObject === 'function' ? quotation.toObject() : quotation;
  const clone = JSON.parse(JSON.stringify(obj));
  eachAccessory(clone, (acc) => {
    PRICE_FIELDS.forEach((field) => delete acc[field]);
  });
  return clone;
}

/** Captura las bases de precio por posición de área/mueble/herraje. */
function captureHardwareBases(quotation) {
  const bases = [];
  eachAccessory(quotation, (acc, a, f, i) => {
    if (!bases[a]) bases[a] = [];
    if (!bases[a][f]) bases[a][f] = [];
    bases[a][f][i] = BASE_FIELDS.reduce((acc2, field) => {
      acc2[field] = acc[field];
      return acc2;
    }, {});
  });
  return bases;
}

/** Restaura las bases de precio originales antes de que el calculador recalcule. */
function restoreHardwareBases(quotation, bases) {
  if (!bases) return;
  let changed = false;
  eachAccessory(quotation, (acc, a, f, i) => {
    const original = bases[a]?.[f]?.[i];
    if (!original) return;
    BASE_FIELDS.forEach((field) => {
      if (original[field] !== undefined) {
        acc[field] = original[field];
        changed = true;
      }
    });
  });
  if (changed && typeof quotation.markModified === 'function') quotation.markModified('areas');
}

module.exports = {
  PRICE_FIELDS,
  redactHardwarePrices,
  captureHardwareBases,
  restoreHardwareBases
};
