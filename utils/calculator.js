/**
 * Utilidad de Backend para validar y recalcular la cotización.
 * Clon exacto de la lógica matemática de `quotation-calculator.service.ts`
 */

function getWasteFactor(quantity, wasteTable) {
  if (!wasteTable || wasteTable.length === 0) {
    return 0;
  }

  for (const item of wasteTable) {
    if (quantity >= item.minMl && quantity <= item.maxMl) {
      return item.factor;
    }
  }

  const maxItem = wasteTable.reduce((prev, current) =>
    prev.maxMl > current.maxMl ? prev : current
  );
  if (quantity > maxItem.maxMl) {
    return maxItem.factor;
  }

  return 0;
}

function calculateGlobalTotals(
  totalCost,
  totalSqm,
  config,
  existingTotals = {},
  totalMesonesSubtotal = 0,
  totalMesonesTax = 0,
  viaticos = 0
) {
  const unforeseenPercent = existingTotals.unforeseenPercent ?? config.unforeseenPercent ?? 10;
  const profitPercent = existingTotals.profitPercent ?? config.profitPercent ?? 35;
  const indirectPercent = existingTotals.indirectPercent ?? config.indirectPercent ?? 32;
  const taxPercent = existingTotals.taxPercent ?? config.taxPercent ?? 19;
  const discountPercent = existingTotals.discountPercent ?? config.defaultDiscount ?? 0;

  const unforeseenAmount = totalCost * (unforeseenPercent / 100);
  const profitAmount = totalCost * (profitPercent / 100);
  const indirectAmount = totalCost * (indirectPercent / 100);

  const subtotal = totalCost + unforeseenAmount + profitAmount + indirectAmount + totalMesonesSubtotal;
  const taxAmount = (totalCost + unforeseenAmount + profitAmount + indirectAmount) * (taxPercent / 100) + totalMesonesTax;
  const totalWithTax = subtotal + taxAmount;

  const discountAmount = totalWithTax * (discountPercent / 100);
  const grandTotal = totalWithTax - discountAmount + viaticos;
  const pricePerSqm = totalSqm > 0 ? grandTotal / totalSqm : 0;

  return {
    totalCost,
    unforeseenPercent,
    unforeseenAmount,
    profitPercent,
    profitAmount,
    indirectPercent,
    indirectAmount,
    subtotal,
    taxPercent,
    taxAmount,
    totalWithTax,
    discountPercent,
    discountAmount,
    grandTotal,
    totalSqm,
    pricePerSqm,
    viaticos
  };
}

function calculateFurnitureTotals(furniture, config) {
  if (furniture.type === 'meson' && furniture.mesonDetails) {
    const md = furniture.mesonDetails;
    md.linearPrice = (md.basePricePerM2 || 0) * (md.depth || 0.8);
    md.baseCost = md.linearPrice + (md.transportCost || 0);
    md.profitAmount = md.baseCost * ((md.profitPercentage || 68) / 100);
    md.subtotal = md.baseCost + md.profitAmount;
    md.taxAmount = md.subtotal * ((md.taxPercentage || 19) / 100);
    md.finalPricePerMl = md.subtotal + md.taxAmount;

    furniture.totalCost = md.baseCost;
    furniture.totalBudget = md.finalPricePerMl * (furniture.areaSqm || 1);
    return;
  }

  const laborRate = config.laborRatePerHour || 0;
  const designRate = config.designRatePerHour || 0;

  // 1. Insumos
  furniture.totalSupplies = 0;
  if (furniture.supplies) {
    furniture.supplies.forEach((s) => {
      const qty = s.total > 0 ? s.total : (s.quantity || 0);
      s.totalPrice = qty * (s.unitPrice || 0);
      furniture.totalSupplies += s.totalPrice;
    });
  }

  // 2. Cantos
  furniture.totalEdgeBands = 0;
  if (furniture.edgeBands) {
    furniture.edgeBands.forEach((e) => {
      const factor = getWasteFactor(e.quantity || 0, config.wasteTable);
      e.wasteFactor = factor;
      e.waste = (e.quantity || 0) * factor;
      e.total = (e.quantity || 0) + e.waste;
      e.totalPrice = e.total * (e.unitPrice || 0);
      furniture.totalEdgeBands += e.totalPrice;
    });
  }

  // 3. Accesorios
  furniture.totalAccessories = 0;
  if (furniture.accessories) {
    furniture.accessories.forEach((a) => {
      a.totalTime = (a.quantity || 0) * (a.timeHours || 0);
      const laborCost = a.totalTime * (a.laborRate || laborRate);
      const materialCost = (a.quantity || 0) * (a.unitPrice || 0);
      a.totalPrice = laborCost + materialCost;
      furniture.totalAccessories += a.totalPrice;
    });
  }

  // 4. Diseño
  furniture.totalDesignTime = 0;
  if (furniture.designTime && !furniture.clientPaidDesign) {
    furniture.designTime.forEach((d) => {
      const rate = d.laborRate || designRate;
      d.totalPrice = (d.quantity || 0) * rate;
      furniture.totalDesignTime += d.totalPrice;
    });
  } else if (furniture.designTime) {
    furniture.designTime.forEach((d) => {
      d.totalPrice = 0;
    });
  }

  // 5. Cortes
  furniture.totalCuts = 0;
  if (furniture.cuts) {
    furniture.cuts.forEach((c) => {
      const workUnits = (c.sqm || 0) * (c.timeHours || 0) * (c.quantity || 1);
      const rate = c.laborRate || laborRate;
      c.totalPrice = workUnits * rate;
      furniture.totalCuts += c.totalPrice;
    });
  }

  // 6. Armado
  furniture.totalAssembly = 0;
  if (furniture.assembly) {
    furniture.assembly.forEach((a) => {
      const workUnits = (a.totalQuantity || 0) * (a.assemblyHours || 0) * (a.persons || 1);
      const rate = a.laborRate || laborRate;
      a.totalPrice = workUnits * rate;
      furniture.totalAssembly += a.totalPrice;
    });
  }

  // 7. Instalación
  furniture.totalInstallation = 0;
  if (furniture.installation) {
    furniture.installation.forEach((i) => {
      const workUnits = (i.totalQuantity || 0) * (i.installHours || 0) * (i.persons || 1);
      const rate = i.laborRate || laborRate;
      i.totalPrice = workUnits * rate;
      furniture.totalInstallation += i.totalPrice;
    });
  }

  // 8. Enchape
  furniture.totalVeneer = 0;
  if (furniture.veneer) {
    furniture.veneer.forEach((v) => {
      v.totalPrice = (v.quantity || 0) * (v.unitPrice || 0);
      furniture.totalVeneer += v.totalPrice;
    });
  }

  furniture.totalCost =
    (furniture.totalSupplies || 0) +
    (furniture.totalEdgeBands || 0) +
    (furniture.totalAccessories || 0) +
    (furniture.totalDesignTime || 0) +
    (furniture.totalCuts || 0) +
    (furniture.totalAssembly || 0) +
    (furniture.totalInstallation || 0) +
    (furniture.totalVeneer || 0);

  furniture.totalBudget = furniture.totalCost;
}

function recalculateAll(quotation, config) {
  // Modo "Venta de productos y servicios": totales directos sobre quotation.products
  if (quotation.wizardConfig && quotation.wizardConfig.clientPriceMode === 'products') {
    quotation.totals = calculateProductsTotals(quotation, config);
    return quotation;
  }

  let globalTotalSqm = 0;
  let globalTotalCost = 0;
  let globalMesonesSubtotal = 0;
  let globalMesonesTax = 0;

  if (quotation.areas) {
    quotation.areas.forEach((area) => {
      let areaTotal = 0;

      if (area.furniture) {
        area.furniture.forEach((furniture) => {
          calculateFurnitureTotals(furniture, config);

          if (furniture.type === 'meson' && furniture.mesonDetails) {
            const fQty = furniture.quantity || 1;
            const fLen = furniture.areaSqm || 1;
            globalMesonesSubtotal += (furniture.mesonDetails.subtotal || 0) * fLen * fQty;
            globalMesonesTax += (furniture.mesonDetails.taxAmount || 0) * fLen * fQty;
            areaTotal += (furniture.totalBudget || 0) * fQty;
          } else {
            areaTotal += (furniture.totalCost || 0) * (furniture.quantity || 1);
          }

          if (furniture.areaSqm && furniture.areaSqm > 0) {
            globalTotalSqm += furniture.areaSqm * (furniture.quantity || 1);
          } else if (furniture.cuts && furniture.cuts.length) {
            const fSqm = furniture.cuts.reduce(
              (sum, cut) => sum + (cut.sqm || 0) * (cut.quantity || 1),
              0
            );
            globalTotalSqm += fSqm * (furniture.quantity || 1);
          }
        });
      }

      if (area.subAreas) {
        area.subAreas.forEach((sub) => {
          let subT = 0;
          if (sub.items) {
            sub.items.forEach((item) => {
              subT += (item.quantity || 0) * (item.price || 0);
            });
          }
          sub.total = subT;
          areaTotal += subT;
        });
      }

      if (area.visibleAccessories) {
        area.visibleAccessories.forEach((acc) => {
          acc.totalPrice = (acc.quantity || 0) * (acc.unitPrice || 0);
          areaTotal += acc.totalPrice;
        });
      }

      area.areaTotal = areaTotal;
    });
  }

  let rawTotalCostForPercentages = 0;
  if (quotation.areas) {
    quotation.areas.forEach((area) => {
      if (area.furniture) {
        area.furniture.forEach((furniture) => {
          if (furniture.type !== 'meson') {
            rawTotalCostForPercentages += (furniture.totalCost || 0) * (furniture.quantity || 1);
          }
        });
      }
      if (area.subAreas) {
        area.subAreas.forEach((sub) => { rawTotalCostForPercentages += (sub.total || 0); });
      }
      if (area.visibleAccessories) {
        area.visibleAccessories.forEach((acc) => { rawTotalCostForPercentages += (acc.totalPrice || 0); });
      }
    });
  }

  quotation.totals = calculateGlobalTotals(
    rawTotalCostForPercentages,
    globalTotalSqm,
    config,
    quotation.totals || {},
    globalMesonesSubtotal,
    globalMesonesTax,
    Number((quotation.client || {}).viaticos || 0)
  );

  return quotation;
}

function calculateProductsTotals(quotation, config) {
  const existing = quotation.totals || {};
  const taxPercent = existing.taxPercent ?? config.taxPercent ?? 19;
  const viaticos = Number((quotation.client || {}).viaticos || 0);

  let subtotal = 0;
  let taxAmount = 0;
  const products = quotation.products || [];
  products.forEach((p) => {
    p.totalWithTax = Math.round((p.quantity || 0) * (p.unitPriceWithTax || 0));
    const net = p.totalWithTax / (1 + taxPercent / 100);
    subtotal += net;
    taxAmount += p.totalWithTax - net;
  });
  subtotal = Math.round(subtotal);
  taxAmount = Math.round(taxAmount);
  const grandTotal = subtotal + taxAmount + viaticos;

  quotation.totals = {
    totalCost: 0,
    unforeseenPercent: existing.unforeseenPercent ?? config.unforeseenPercent ?? 10,
    unforeseenAmount: 0,
    profitPercent: existing.profitPercent ?? config.profitPercent ?? 35,
    profitAmount: 0,
    indirectPercent: existing.indirectPercent ?? config.indirectPercent ?? 32,
    indirectAmount: 0,
    subtotal,
    taxPercent,
    taxAmount,
    totalWithTax: subtotal + taxAmount,
    discountPercent: 0,
    discountAmount: 0,
    grandTotal,
    totalSqm: 0,
    pricePerSqm: 0,
    viaticos
  };
  return quotation;
}

module.exports = {
  recalculateAll,
  getWasteFactor,
  calculateFurnitureTotals,
  calculateGlobalTotals,
  calculateProductsTotals
};
