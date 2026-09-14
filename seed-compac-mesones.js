/**
 * seed-compac-mesones.js
 * 
 * Script de seed one-time: inserta los materiales de Compact Slab by Lamitech
 * (pestaña COMPAC del Excel "PRECIO MESONES PARA COTIZADOR") bajo la categoría 'meson',
 * SOLO si aún no existen en la base de datos.
 * 
 * Se ejecuta al arrancar el servidor (llamado desde index.js).
 */
const Material = require('./models/Material');

const COMPAC_MATERIALS = [
  { code: '3170 Himalaya', description: 'F125 3170 Himalaya 1.53 x 3.66 SC Blanco', provider: 'COMPAC', color: 'Blanco', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 602664.38, pricePerSheet: 3374800 },
  { code: '3171 Palazzo', description: 'F125 3171 Palazzo 1.53 x 3.66 SC Negro', provider: 'COMPAC', color: 'Negro', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 399614.27, pricePerSheet: 2237760 },
  { code: '3172 Tiziano', description: 'F125 3172 Tiziano 1.53 x 3.66 CA Negro', provider: 'COMPAC', color: 'Negro', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 399614.27, pricePerSheet: 2237760 },
  { code: '3176 Atenas', description: 'F125 3176 Atenas 1.53 x 3.66 PL Blanco', provider: 'COMPAC', color: 'Blanco', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 602664.38, pricePerSheet: 3374800 },
  { code: '2260 OPAK Black', description: 'F125 2260 OPAK Black 1.53 x 3.66 OPAK Negro', provider: 'COMPAC', color: 'Negro', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 658823.53, pricePerSheet: 3689280 },
  { code: '3158 REAL Sta. Bianco', description: 'F125 3158 REAL Sta. Bianco 1.53 x 3.66 REAL Gris', provider: 'COMPAC', color: 'Gris', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 634422.66, pricePerSheet: 3552640 },
  { code: '3178 Alicante', description: 'F125 3178 Alicante 1.53 x 3.66 CA Beige', provider: 'COMPAC', color: 'Beige', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 634422.66, pricePerSheet: 3552640 },
  { code: '3177 Positano', description: 'F125 3177 Positano 1.53 x 3.66 CA Gris', provider: 'COMPAC', color: 'Gris', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 634422.66, pricePerSheet: 3552640 },
  { code: '3183 Roma', description: 'F125 3183 Roma 1.53 x 3.66 CA Beige', provider: 'COMPAC', color: 'Beige', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 634422.66, pricePerSheet: 3552640 },
  { code: '3184 Tunisia', description: 'F125 3184 Tunisia 1.53 x 3.66 CA Negro', provider: 'COMPAC', color: 'Negro', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 399614.27, pricePerSheet: 2237760 },
  { code: '3185 Tibet', description: 'F125 3185 Tibet 1.53 x 3.66 SC Blanco', provider: 'COMPAC', color: 'Blanco', dimension: '1.53 x 3.66', unit: 'M2', unitPrice: 602664.38, pricePerSheet: 3374800 }
];

async function seedCompacMesones() {
  try {
    // Verificar si ya existen materiales COMPAC en la categoría meson
    const existingCount = await Material.countDocuments({ category: 'meson', provider: 'COMPAC' });
    if (existingCount > 0) {
      console.log(`[seed-compac] Ya existen ${existingCount} materiales COMPAC en mesones. Saltando seed.`);
      return;
    }

    const docs = COMPAC_MATERIALS.map(m => ({
      category: 'meson',
      code: m.code,
      description: m.description,
      provider: m.provider,
      color: m.color,
      dimension: m.dimension,
      unit: m.unit,
      unitPrice: m.unitPrice,
      pricePerSheet: m.pricePerSheet,
      measure1: 1.53,
      measure2: 3.66,
      active: true
    }));

    await Material.insertMany(docs);
    console.log(`[seed-compac] ✅ ${docs.length} materiales COMPAC insertados en categoría 'meson'.`);
  } catch (err) {
    console.error('[seed-compac] Error al insertar materiales COMPAC:', err.message);
  }
}

module.exports = seedCompacMesones;
