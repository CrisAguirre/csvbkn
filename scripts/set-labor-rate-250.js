/**
 * Ajuste global del valor del minuto de mano de obra a $250.
 * Idempotente. Por defecto solo informa; ejecutar con --apply para escribir.
 *
 * - Config.laborRatePerHour = 15000 (250 × 60)
 * - LaborTime.valorMinuto = 250 para todas las actividades de armado/instalación
 *
 * Las cotizaciones ya guardadas NO se tocan: tienen precio efectivo congelado
 * por insumo y valorMinuto congelado por canto/armado/instalación.
 */
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const MINUTO = 250;
const POR_HORA = MINUTO * 60;
const APPLY = process.argv.includes('--apply');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en .env');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db();

  const config = await db.collection('configs').findOne({ key: 'global' });
  const laborTimes = await db.collection('labortimes').find({}).toArray();
  const distintos = laborTimes.filter((l) => l.valorMinuto !== MINUTO);

  console.log('Modo:', APPLY ? 'APLICAR' : 'simulación (--apply para escribir)');
  console.log('Config laborRatePerHour actual:', config?.laborRatePerHour, '→', POR_HORA);
  console.log('LaborTime:', laborTimes.length, 'actividades;', distintos.length, 'con valorMinuto distinto de', MINUTO);
  if (distintos.length) {
    console.log('Valores actuales:', [...new Set(distintos.map((l) => l.valorMinuto))].join(', '));
  }

  if (APPLY) {
    const r1 = await db.collection('configs').updateOne(
      { key: 'global' },
      { $set: { laborRatePerHour: POR_HORA } }
    );
    const r2 = await db.collection('labortimes').updateMany(
      { valorMinuto: { $ne: MINUTO } },
      { $set: { valorMinuto: MINUTO } }
    );
    console.log('Config actualizados:', r1.modifiedCount);
    console.log('LaborTime actualizados:', r2.modifiedCount);
  }

  await client.close();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
