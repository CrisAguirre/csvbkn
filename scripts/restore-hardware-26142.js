#!/usr/bin/env node
/**
 * Repara los herrajes perdidos en cotizaciones 26142* usando SOLO la copia de
 * seguridad de las 12:53 del 2026-11-19.
 *
 * Regla: conserva todo lo que existe hoy (herrajes nuevos de ayer, cantidades,
 * precios y totales). Solo agrega los herrajes del backup que ya no están,
 * emparejando por área + mueble + descripción. Nunca modifica:
 *   wizardConfig.hardwareDisplayMode (afecta SOLO al PDF), presentedAt, version.
 *
 * Uso:  node scripts/restore-hardware-26142.js           (simulación)
 *       node scripts/restore-hardware-26142.js --apply   (escribe)
 */
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const { EJSON } = require('bson');
const readline = require('readline');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { recalculateAll } = require('../utils/calculator');
const Quotation = require('../models/Quotation');

const BACKUP = process.env.BACKUP_FILE || 'C:\\Users\\USUARIO\\Desktop\\safe\\backup.ndjson.gz.enc';
const KEY_FILE = process.env.BACKUP_KEY_FILE ||
  'C:\\Users\\USUARIO\\AppData\\Local\\Temp\\opencode\\spaziovitale-backup-key.txt';
const APPLY = process.argv.includes('--apply');
const PREFIX = '26142';
const MAGIC = Buffer.from('SPZBAK01');
const HLEN = MAGIC.length + 16 + 12 + 16;
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function* lines(stream) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

function readBackup(path, passphrase) {
  const buf = fs.readFileSync(path);
  const h = buf.subarray(0, HLEN);
  if (!h.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Backup inválido: cabecera incorrecta');
  const key = crypto.scryptSync(passphrase, h.subarray(MAGIC.length, MAGIC.length + 16), 32);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', key, h.subarray(MAGIC.length + 16, MAGIC.length + 28)
  );
  decipher.setAuthTag(h.subarray(MAGIC.length + 28, HLEN));
  const plain = Buffer.concat([decipher.update(buf.subarray(HLEN)), decipher.final()]);
  return zlib.gunzipSync(plain).toString('utf8');
}

function cleanAcc(acc) {
  const out = {};
  for (const [k, v] of Object.entries(acc)) {
    if (!k.startsWith('_') && k !== '_id') out[k] = v;
  }
  return out;
}

(async () => {
  if (!fs.existsSync(BACKUP)) throw new Error('No existe el backup: ' + BACKUP);
  const passphrase = fs.readFileSync(KEY_FILE, 'utf8').trim();
  const ndjson = readBackup(BACKUP, passphrase);

  const oldQuotes = [];
  for await (const l of lines(require('stream').Readable.from([ndjson]))) {
    if (!l.trim()) continue;
    const wrapper = JSON.parse(l);
    if (wrapper.c === 'quotations') oldQuotes.push(EJSON.parse(JSON.stringify(wrapper.d)));
  }
  const oldByNum = new Map(
    oldQuotes.filter((q) => String(q.number).startsWith(PREFIX)).map((q) => [Number(q.number), q])
  );

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  if (APPLY) await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = client.db();
  const config = await db.collection('configs').findOne({ key: 'global' });
  const current = (await db.collection('quotations').find({}).toArray())
    .filter((q) => String(q.number).startsWith(PREFIX));

  let totalRestored = 0;
  let quotesChanged = 0;

  for (const q of current.sort((a, b) => a.number - b.number)) {
    const old = oldByNum.get(Number(q.number));
    if (!old) continue; // cotización nueva: no tocar

    const oldByFurniture = new Map();
    for (const area of old.areas || []) {
      for (const furn of area.furniture || []) {
        const key = `${norm(area.name)}|${norm(furn.name)}`;
        const list = oldByFurniture.get(key) || [];
        for (const acc of furn.accessories || []) list.push(cleanAcc(acc));
        oldByFurniture.set(key, list);
      }
    }

    let restored = 0;
    for (const area of q.areas || []) {
      for (const furn of area.furniture || []) {
        const key = `${norm(area.name)}|${norm(furn.name)}`;
        const candidates = oldByFurniture.get(key) || [];
        if (!candidates.length) continue;
        const have = new Set((furn.accessories || []).map((x) => norm(x.description)));
        for (const acc of candidates) {
          const d = norm(acc.description);
          if (have.has(d)) continue;
          furn.accessories = furn.accessories || [];
          furn.accessories.push(JSON.parse(JSON.stringify(acc)));
          have.add(d);
          restored += 1;
        }
      }
    }

    if (!restored) continue;

    // Recalcular SOLO esta cotización: el resto de campos frescos (M.O. por m²,
    // cantos, etc.) ya tienen precio congelado y no cambian.
    const before = q.totals?.grandTotal || 0;
    if (config) recalculateAll(q, config);
    const after = q.totals?.grandTotal || 0;

    console.log(`No. ${q.number}: +${restored} herrajes | grandTotal ${before.toFixed(0)} -> ${after.toFixed(0)}`);
    totalRestored += restored;
    quotesChanged += 1;

    if (APPLY) {
      const doc = await Quotation.findById(q._id);
      doc.areas = q.areas;
      doc.totals = q.totals;
      doc.markModified('areas');
      doc.markModified('totals');
      await doc.save();
    }
  }

  console.log('\nModo:', APPLY ? 'APLICADO' : 'simulación (--apply para escribir)');
  console.log('Cotizaciones afectadas:', quotesChanged, '| herrajes restaurados:', totalRestored);
  await client.close();
  if (APPLY) await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
