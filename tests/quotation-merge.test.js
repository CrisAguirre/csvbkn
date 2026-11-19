const { WINDOW_DAYS, withinDays, compatibleCandidates, mergeQuotations } = require('../utils/quotation-merge');

const q = (id, number, name, date, grandTotal = 100000) => ({
  _id: id,
  number,
  date,
  client: { name },
  totals: { grandTotal },
  areas: [{
    name: 'COCINA',
    furniture: [{
      name: 'Mueble A', type: 'mueble', quantity: 1,
      supplies: [{ description: 'Melamina', quantity: 2, unitPrice: 50000, totalPrice: 100000 }]
    }]
  }]
});

describe('Fusión de cotizaciones', () => {
  const target = q('a', 100, 'Cliente Uno', '2026-11-10T00:00:00Z');

  it('acepta solo cotizaciones del mismo cliente dentro de 7 días', () => {
    const same = q('b', 101, 'cliente uno  ', '2026-11-14T00:00:00Z');
    const old = q('c', 102, 'Cliente Uno', '2026-11-01T00:00:00Z');
    const other = q('d', 103, 'Otro Cliente', '2026-11-12T00:00:00Z');

    expect(WINDOW_DAYS).toBe(7);
    expect(withinDays(target, same)).toBe(true);
    expect(withinDays(target, old)).toBe(false);
    expect(compatibleCandidates(target, [target, same, old, other]).map((x) => x.number)).toEqual([101]);
  });

  it('consolida áreas y muebles repetidos sumando cantidades e ítems', () => {
    const source = q('b', 101, 'Cliente Uno', '2026-11-14T00:00:00Z');
    const merged = mergeQuotations(target, [source]);

    expect(merged.areas.length).toBe(1);
    expect(merged.areas[0].furniture.length).toBe(1);
    expect(merged.areas[0].furniture[0].quantity).toBe(2);
    expect(merged.areas[0].furniture[0].supplies.length).toBe(2);
    expect(merged.status).toBe('borrador');
    expect(merged.mergedFrom.map((x) => x.number)).toEqual([100, 101]);
    // Los números de origen quedan solo en auditoría, nunca en notas (que van al PDF).
    expect(merged.notes).not.toContain('100');
    expect(merged.notes).not.toContain('101');
  });
});
