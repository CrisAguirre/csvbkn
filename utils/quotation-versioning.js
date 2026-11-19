/**
 * Versionado de cotizaciones presentadas al cliente.
 * La presentación es el punto de inflexión: a partir de ahí la cotización es
 * un documento cerrado. Las ediciones de admin crean una versión dentro del
 * mismo documento (nunca duplican la cotización).
 */

function isPresented(quotation) {
  return !!(quotation && quotation.presentedAt);
}

/** Copia de los datos que definen el precio, para recuperar la versión anterior. */
function buildVersionSnapshot(quotation) {
  const obj = typeof quotation.toObject === 'function' ? quotation.toObject() : quotation;
  return {
    number: obj.number,
    date: obj.date,
    city: obj.city,
    installationAddress: obj.installationAddress,
    sameAddress: obj.sameAddress,
    client: obj.client,
    title: obj.title,
    areas: obj.areas,
    products: obj.products,
    designs: obj.designs,
    totals: obj.totals,
    wizardConfig: obj.wizardConfig,
    status: obj.status,
    paymentTerms: obj.paymentTerms,
    validityDays: obj.validityDays,
    notes: obj.notes,
    presentedAt: obj.presentedAt
  };
}

/** Versiona la cotización ANTES de aplicar cambios. */
function recordVersion(quotation, user, reason) {
  quotation.versionHistory = quotation.versionHistory || [];
  quotation.versionHistory.push({
    version: quotation.version || 1,
    changedAt: new Date(),
    changedBy: user?.id ? String(user.id) : '',
    changedByEmail: user?.email || '',
    reason: reason || 'Edición de cotización presentada',
    snapshot: buildVersionSnapshot(quotation)
  });
  quotation.version = (quotation.version || 1) + 1;
  if (typeof quotation.markModified === 'function') quotation.markModified('versionHistory');
  return quotation;
}

module.exports = { isPresented, buildVersionSnapshot, recordVersion };
