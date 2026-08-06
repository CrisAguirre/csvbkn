const {
  getWasteFactor,
  calculateGlobalTotals,
  calculateFurnitureTotals,
  recalculateAll
} = require('../utils/calculator');

describe('Calculator Utils', () => {
  const mockConfig = {
    laborRatePerHour: 12000,
    designRatePerHour: 15000,
    unforeseenPercent: 10,
    profitPercent: 35,
    indirectPercent: 32,
    taxPercent: 19,
    defaultDiscount: 5,
    wasteTable: [
      { minMl: 0, maxMl: 5, factor: 0.30 },
      { minMl: 5.1, maxMl: 25, factor: 0.20 },
      { minMl: 25.1, maxMl: 1000, factor: 0.15 }
    ]
  };

  describe('getWasteFactor()', () => {
    it('debe devolver 0 si no hay tabla', () => {
      expect(getWasteFactor(10, [])).toBe(0);
    });

    it('debe devolver el factor correcto según el rango', () => {
      expect(getWasteFactor(3, mockConfig.wasteTable)).toBe(0.30);
      expect(getWasteFactor(15, mockConfig.wasteTable)).toBe(0.20);
      expect(getWasteFactor(50, mockConfig.wasteTable)).toBe(0.15);
    });

    it('debe usar el factor máximo si excede la tabla', () => {
      expect(getWasteFactor(2000, mockConfig.wasteTable)).toBe(0.15);
    });
  });

  describe('calculateFurnitureTotals()', () => {
    it('debe calcular insumos correctamente', () => {
      const furniture = {
        supplies: [{ quantity: 2, total: 0, unitPrice: 5000 }]
      };
      calculateFurnitureTotals(furniture, mockConfig);
      expect(furniture.totalSupplies).toBe(10000);
      expect(furniture.totalCost).toBe(10000);
    });

    it('debe calcular cantos con desperdicio', () => {
      // 10 ML -> factor 0.20 -> desperdicio 2 -> total 12 ML
      // precio = 12 * 1000 = 12000 ; M.O. = 12 ML × 3 min × valorMinuto (12000/60=2000) = 3600
      const furniture = {
        edgeBands: [{ quantity: 10, unitPrice: 1000, moMinutesPerMl: 3 }]
      };
      calculateFurnitureTotals(furniture, mockConfig);
      expect(furniture.edgeBands[0].wasteFactor).toBe(0.20);
      expect(furniture.edgeBands[0].moTotal).toBe(7200);
      expect(furniture.totalEdgeBands).toBe(19200); // 12000 material + 7200 M.O.
      expect(furniture.totalCost).toBe(19200);
    });

    it('debe calcular mesones correctamente', () => {
      const furniture = {
        type: 'meson',
        areaSqm: 2, // ML
        mesonDetails: {
          basePricePerM2: 100000,
          depth: 0.8,
          transportCost: 20000,
          profitPercentage: 50,
          taxPercentage: 10
        }
      };
      calculateFurnitureTotals(furniture, mockConfig);
      // linearPrice = 100000 * 0.8 = 80000
      // baseCost = 80000 + 20000 = 100000
      // profit = 100000 * 50% = 50000
      // subtotal = 150000
      // tax = 150000 * 10% = 15000
      // finalPricePerMl = 165000
      // totalBudget = 165000 * 2 (areaSqm) = 330000
      expect(furniture.mesonDetails.linearPrice).toBe(80000);
      expect(furniture.mesonDetails.subtotal).toBe(150000);
      expect(furniture.totalBudget).toBe(330000);
    });
  });

  describe('calculateGlobalTotals()', () => {
    it('debe calcular porcentajes y gran total correctamente', () => {
      // totalCost = 100,000
      const totals = calculateGlobalTotals(100000, 10, mockConfig);
      
      // unforeseen (10%) = 10,000
      // profit (35%) = 35,000
      // indirect (32%) = 32,000
      expect(totals.unforeseenAmount).toBe(10000);
      expect(totals.profitAmount).toBe(35000);
      expect(totals.indirectAmount).toBe(32000);

      // subtotal = 100,000 + 10,000 + 35,000 + 32,000 = 177,000
      expect(totals.subtotal).toBe(177000);

      // tax (19%) = 177,000 * 0.19 = 33,630
      expect(totals.taxAmount).toBe(33630);

      // totalWithTax = 177,000 + 33,630 = 210,630
      expect(totals.totalWithTax).toBe(210630);

      // discount (5%) = 210,630 * 0.05 = 10,531.5
      expect(totals.discountAmount).toBe(10531.5);

      // grandTotal = 210,630 - 10,531.5 = 200,098.5
      expect(totals.grandTotal).toBe(200098.5);
      
      // pricePerSqm = 200,098.5 / 10 = 20009.85
      expect(totals.pricePerSqm).toBe(20009.85);
    });
  });

  describe('recalculateAll()', () => {
    it('debe procesar toda la cotización de extremo a extremo', () => {
      const quotation = {
        totals: {
          discountPercent: 0 // Forzamos 0% para simplificar la prueba
        },
        areas: [
          {
            furniture: [
              {
                type: 'custom',
                quantity: 1,
                supplies: [{ quantity: 1, unitPrice: 100000 }] // totalCost: 100k
              }
            ],
            subAreas: [
              {
                items: [{ quantity: 2, price: 5000 }] // subT: 10k
              }
            ],
            visibleAccessories: [
              { quantity: 1, unitPrice: 40000 } // acc: 40k
            ]
          }
        ]
      };

      // rawTotalCostForPercentages = 100k + 10k + 40k = 150,000
      const result = recalculateAll(quotation, mockConfig);
      
      // Subtotal de los muebles/items = 150k
      // unforeseen (10%) = 15k
      // profit (35%) = 52.5k
      // indirect (32%) = 48k
      // Subtotal global = 150k + 15k + 52.5k + 48k = 265,500
      // Tax (19%) = 265,500 * 0.19 = 50,445
      // Total w/ Tax = 265,500 + 50,445 = 315,945
      
      expect(result.totals.totalCost).toBe(150000);
      expect(result.totals.subtotal).toBe(265500);
      expect(result.totals.grandTotal).toBe(315945);
    });

    it('debe respetar los valores alterados maliciosamente y sobreescribirlos', () => {
      const quotation = {
        areas: [{
          furniture: [{
            type: 'custom',
            quantity: 1,
            supplies: [{ quantity: 1, unitPrice: 100000 }],
            totalCost: 1, // MALICIOSO
            totalBudget: 1 // MALICIOSO
          }]
        }],
        totals: {
          grandTotal: 1, // MALICIOSO
          totalCost: 1, // MALICIOSO
          discountPercent: 0
        }
      };

      const result = recalculateAll(quotation, mockConfig);
      
      // Los valores maliciosos (1) deben ser sobreescritos por los reales (100k y 210,630)
      expect(result.areas[0].furniture[0].totalCost).toBe(100000);
      expect(result.totals.totalCost).toBe(100000);
      expect(result.totals.grandTotal).toBe(210630); // (100k * 1.77) * 1.19
    });
  });
});
