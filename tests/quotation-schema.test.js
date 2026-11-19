const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');

describe('Quotation schema - identidad estable de insumos', () => {
  const base = (supplies) => ({
    number: 999999,
    client: { name: 'Cliente de prueba' },
    createdBy: new mongoose.Types.ObjectId(),
    areas: [{ name: 'Area', furniture: [{ name: 'Mueble', supplies }] }]
  });

  it('conserva marca, color, proveedor y base de M.O. al serializar', () => {
    const quotation = new Quotation(base([{
      description: 'Melamina',
      brand: 'Pelikano',
      provider: 'Proveedor X',
      color: 'Blanco',
      materialId: 'mat-1',
      materialCode: 'MEL-01',
      quantityMode: 'sqm',
      quantity: 3,
      unitPrice: 100000,
      sqmPerSheet: 3,
      laborMinutes: 30,
      effectiveUnitPrice: 150000
    }]));

    const supply = quotation.toObject().areas[0].furniture[0].supplies[0];
    expect(supply.brand).toBe('Pelikano');
    expect(supply.color).toBe('Blanco');
    expect(supply.provider).toBe('Proveedor X');
    expect(supply.materialId).toBe('mat-1');
    expect(supply.materialCode).toBe('MEL-01');
    expect(supply.sqmPerSheet).toBe(3);
    expect(supply.laborMinutes).toBe(30);
    expect(supply.effectiveUnitPrice).toBe(150000);
  });

  it('tolera documentos legacy sin marca ni color', () => {
    const quotation = new Quotation(base([{
      description: 'Melamina', quantity: 1, unitPrice: 1000
    }]));

    const supply = quotation.toObject().areas[0].furniture[0].supplies[0];
    expect(supply.brand).toBe('');
    expect(supply.color).toBe('');
    expect(supply.sqmPerSheet).toBe(0);
    expect(supply.laborMinutes).toBe(0);
    expect(supply.effectiveUnitPrice).toBe(0);
  });

  it('conserva el valor del minuto congelado en los cantos', () => {
    const doc = {
      number: 999998,
      client: { name: 'Cliente de prueba' },
      createdBy: new mongoose.Types.ObjectId(),
      areas: [{
        name: 'Area',
        furniture: [{ name: 'Mueble', edgeBands: [{ description: 'Canto', valorMinuto: 100 }] }]
      }]
    };
    const quotation = new Quotation(doc);
    const edge = quotation.toObject().areas[0].furniture[0].edgeBands[0];
    expect(edge.valorMinuto).toBe(100);
  });
});
