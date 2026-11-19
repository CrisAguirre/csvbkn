const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const { isPresented, recordVersion } = require('../utils/quotation-versioning');

describe('Versionado de cotizaciones presentadas', () => {
  const make = (presentedAt) => new Quotation({
    number: 2700,
    client: { name: 'Cliente' },
    createdBy: new mongoose.Types.ObjectId(),
    presentedAt: presentedAt || null,
    areas: [{ name: 'Area', furniture: [{ name: 'Mueble', supplies: [{ description: 'Melamina', quantity: 2, unitPrice: 100000 }] }] }],
    totals: { grandTotal: 500000, totalCost: 200000 }
  });

  it('solo considera presentada una cotización con presentedAt', () => {
    expect(isPresented(make())).toBe(false);
    expect(isPresented(make(new Date()))).toBe(true);
  });

  it('guarda la versión anterior con fecha y usuario antes de editar', () => {
    const q = make(new Date('2026-11-19T12:00:00Z'));
    const totalAnterior = q.totals.grandTotal;

    recordVersion(q, { id: 'user-1', email: 'admin@sv.com' }, 'Ajuste de precio');

    expect(q.version).toBe(2);
    expect(q.versionHistory.length).toBe(1);
    const v = q.versionHistory[0];
    expect(v.version).toBe(1);
    expect(v.changedByEmail).toBe('admin@sv.com');
    expect(v.changedAt).toBeInstanceOf(Date);
    expect(v.reason).toBe('Ajuste de precio');
    // El snapshot es del estado ANTES del cambio.
    expect(v.snapshot.totals.grandTotal).toBe(totalAnterior);
    expect(v.snapshot.areas[0].furniture[0].supplies[0].unitPrice).toBe(100000);
  });

  it('el esquema persiste presentedAt, version y el historial', () => {
    const q = make(new Date('2026-11-19T12:00:00Z'));
    recordVersion(q, { id: 'user-1', email: 'admin@sv.com' });
    const obj = q.toObject();
    expect(obj.presentedAt).toBeInstanceOf(Date);
    expect(obj.version).toBe(2);
    expect(obj.versionHistory[0].snapshot.totals.grandTotal).toBe(500000);
  });
});
