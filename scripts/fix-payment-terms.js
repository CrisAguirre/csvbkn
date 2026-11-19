/**
 * Corrige el texto comercial "ABONO INICIAL DEL 35%" → "SEGUNDO ABONO DEL 35%"
 * en cotizaciones ya guardadas. No modifica totales, porcentajes ni fechas.
 * Por defecto solo informa; ejecutar con --apply para escribir.
 */
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const VIEJO = /abono inicial del\s*35\s*%/gi;
const NUEVO = 'Segundo Abono del 35%';
const APPLY = process.argv.includes('--apply');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en .env');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db();

  const docs = await db.collection('quotations').find({ paymentTerms: VIEJO }).toArray();
  console.log('Modo:', APPLY ? 'APLICAR' : 'simulación (--apply para escribir)');
  console.log('Cotizaciones con texto antiguo:', docs.length);

  if (APPLY && docs.length) {
    for (const doc of docs) {
      const nuevo = doc.paymentTerms.replace(VIEJO, NUEVO);
      await db.collection('quotations').updateOne({ _id: doc._id }, { $set: { paymentTerms: nuevo } });
    }
    console.log('Cotizaciones actualizadas:', docs.length);
  }

  await client.close();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
