const {
  redactHardwarePrices,
  captureHardwareBases,
  restoreHardwareBases
} = require('../utils/hardware-redaction');

const makeQuotation = () => ({
  number: 2700,
  areas: [{
    name: 'Area',
    furniture: [{
      name: 'Mueble',
      accessories: [
        { description: 'Herraje A', quantity: 2, unitPrice: 10000, laborRate: 1000, totalPrice: 22000 },
        { description: 'Herraje B', quantity: 1, unitPrice: 5000, laborRate: 500, totalPrice: 5500 }
      ]
    }]
  }]
});

describe('Redacción de precios de herrajes para no-admin', () => {
  it('quita todos los precios sin mutar el documento original', () => {
    const original = makeQuotation();
    const redacted = redactHardwarePrices(original);

    const acc = redacted.areas[0].furniture[0].accessories[0];
    expect(acc.description).toBe('Herraje A');
    expect(acc.quantity).toBe(2);
    expect(acc.unitPrice).toBeUndefined();
    expect(acc.totalPrice).toBeUndefined();
    expect(acc.laborRate).toBeUndefined();
    expect(acc.totalWithTax).toBeUndefined();
    // El original sigue intacto para el cálculo del servidor.
    expect(original.areas[0].furniture[0].accessories[0].unitPrice).toBe(10000);
  });

  it('conserva las bases de precio al editar como no-admin', () => {
    const quotation = makeQuotation();
    const bases = captureHardwareBases(quotation);

    // Simula lo que llega del navegador: precios redactados, cantidad cambiada.
    quotation.areas[0].furniture[0].accessories[0].quantity = 4;
    delete quotation.areas[0].furniture[0].accessories[0].unitPrice;
    delete quotation.areas[0].furniture[0].accessories[0].laborRate;
    restoreHardwareBases(quotation, bases);

    const acc = quotation.areas[0].furniture[0].accessories[0];
    expect(acc.quantity).toBe(4);
    expect(acc.unitPrice).toBe(10000);
    expect(acc.laborRate).toBe(1000);
  });
});
