const mongoose = require('mongoose');
const Quotation = require('./models/Quotation'); // Asegúrate de que la ruta sea correcta
// Configura la URI de tu base de datos aquí si es diferente
const DB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0'; 

async function migrateQuotations() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(DB_URI);
    console.log('✅ Conectado exitosamente.\n');

    console.log('Buscando cotizaciones con formato antiguo...');
    const quotations = await Quotation.find({});
    
    let updatedCount = 0;

    for (const q of quotations) {
      if (!q.wizardConfig) continue;

      let needsUpdate = false;
      let wc = q.wizardConfig;

      // 1. Migrar clientPriceMode
      // Valores viejos: 'proportional', 'sqm'
      // Nuevos: 'unit_sqm', 'manual', 'outsource'
      if (wc.clientPriceMode === 'sqm') {
        wc.clientPriceMode = 'unit_sqm';
        needsUpdate = true;
      } else if (wc.clientPriceMode === 'proportional') {
        wc.clientPriceMode = 'manual';
        needsUpdate = true;
      }

      // 2. Migrar mesonMode
      // Valores viejos: 'special', 'standard', 'none'
      // Nuevos: 'includes_meson', 'no_meson'
      if (wc.mesonMode === 'special' || wc.mesonMode === 'standard') {
        wc.mesonMode = 'includes_meson';
        needsUpdate = true;
      } else if (wc.mesonMode === 'none') {
        wc.mesonMode = 'no_meson';
        needsUpdate = true;
      }

      if (needsUpdate) {
        // Guardamos ignorando validaciones estrictas por si faltan otros campos
        await Quotation.updateOne({ _id: q._id }, { $set: { wizardConfig: wc } });
        console.log(`✅ Cotización ${q.number || q._id} actualizada.`);
        updatedCount++;
      }
    }

    console.log(`\n🎉 Migración completada. ${updatedCount} cotizaciones actualizadas.`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB.');
    process.exit(0);
  }
}

migrateQuotations();
