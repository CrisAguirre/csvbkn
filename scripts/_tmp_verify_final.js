const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db();

  const config = await db.collection('configs').findOne({ key: 'global' });
  const labor = await db.collection('labortimes').find({}).toArray();
  const qs = await db.collection('quotations').find({}).toArray();

  console.log('Config laborRatePerHour:', config?.laborRatePerHour);
  console.log('Config paymentTerms contiene texto nuevo:', /segundo abono del\s*35\s*%/i.test(JSON.stringify(config?.paymentTerms || '')));
  console.log('LaborTime valorMinuto distinto de 250:', labor.filter((l) => l.valorMinuto !== 250).length, '/', labor.length);
  console.log('Cotizaciones:', qs.length);
  console.log('con presentedAt:', qs.filter((q) => q.presentedAt).length);
  console.log('con version > 1:', qs.filter((q) => (q.version || 1) > 1).length);
  console.log('con mergedFrom:', qs.filter((q) => q.mergedFrom?.length).length);
  console.log('con texto antiguo “ABONO INICIAL DEL 35%”:', qs.filter((q) => /abono inicial del\s*35\s*%/i.test(q.paymentTerms || '')).length);
  console.log('sin totals.grandTotal:', qs.filter((q) => !q.totals || !q.totals.grandTotal).length);
  console.log('suma grandTotal:', qs.reduce((s, q) => s + (q.totals?.grandTotal || 0), 0).toLocaleString('es-CO'));

  await client.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
