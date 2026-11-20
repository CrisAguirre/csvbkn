#!/usr/bin/env node
/**
 * Revierte la reparación del 2026-11-20 que había reintroducido herrajes
 * eliminados intencionalmente la tarde del 2026-11-19.
 *
 * Fuente de verdad: la copia creada JUSTO ANTES de esa reparación
 * (safe/antes-reparacion-2026-11-20), que captura las eliminaciones y adiciones
 * de ayer en la tarde. Solo se restauran los 13 documentos que modificó la
 * reparación; el resto de cotizaciones no se toca.
 *
 * Uso:  node scripts/revert-hardware-repair.js           (simulación)
 *       node scripts/revert-hardware-repair.js --apply   (escribe)
 */
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const { EJSON } = require('bson');
const readline = require('readline');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const Quotation = require('../models/Quotation');

const BACKUP = process.env.BACKUP_FILE ||
  'C:\\Users\\USUARIO\\Desktop\\safe\\antes-reparacion-2026-11-20\\backup.ndjson.gz.enc';
const KEY_FILE = process.env.BACKUP_KEY_FILE ||
  'C:\\Users\\USUARIO\\AppData\\Local\\Temp\\opencode\\spaziovitale-backup-key.txt';
const APPLY = process.argv.includes('--apply');
const AFFECTED = [261421, 261422, 261423, 261424, 261425, 261426, 261427, 261428,
  2614210, 2614211, 2614212, 2614213, 2614214];
const MAGIC = Buffer.from('SPZBAK01');
const HLEN = MAGIC.length + 16 + 12 + 16;

async function* lines(stream) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

function readBackup(path, passphrase) {
  const buf = fs.readFileSync(path);
  const h = buf.subarray(0, HLEN);
  if (!h.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Cabecera de backup inválida');
  const key = crypto.scryptSync(passphrase, h.subarray(MAGIC.length, MAGIC.length + 16), 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, h.subarray(MAGIC.length + 16, MAGIC.length + 28));
  d.setAuthTag(h.subarray(MAGIC.length + 28, HLEN));
  const plain = Buffer.concat([d.update(buf.subarray(HLEN)), d.final()]);
  return zlib.gunzipSync(plain).toString('utf8');
}

function safeFields(q) {
  const out = { ...q };
  delete out._id;
  delete out.createdAt;
  delete out.updatedAt;
  delete out.__v;
  return out;
}

(async () => {
  const passphrase = fs.readFileSync(KEY_FILE, 'utf8').trim();
  const ndjson = readBackup(BACKUP, passphrase);
  const byNumber = new Map();
  for await (const l of lines(require('stream').Readable.from([ndjson]))) {
    if (!l.trim()) continue;
    const w = JSON.parse(l);
    if (w.c !== 'quotations') continue;
    const q = EJSON.parse(JSON.stringify(w.d));
    if (AFFECTED.includes(Number(q.number))) byNumber.set(Number(q.number), q);
  }
  if (byNumber.size !== AFFECTED.length) {
    throw new Error(`El backup tiene ${byNumber.size} de ${AFFECTED.length} cotizaciones afectadas`);
  }

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  if (APPLY) await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = client.db();

  for (const number of AFFECTED) {
    const expected = byNumber.get(number);
    const current = await db.collection('quotations').findOne({ number });
    if (!current) throw new Error(`Falta la cotización ${number} en producción`);
    const pending = current.totals?.grandTotal !== expected.totals?.grandTotal;
    console.log(`No. ${number}: grandTotal actual=${(current.totals?.grandTotal || 0).toFixed(0)} | estado ayer en la tarde=${(expected.totals?.grandTotal || 0).toFixed(0)} ${pending ? '(a revertir)' : '(ya coincide)'}`);
    if (APPLY && pending) {
      const doc = await Quotation.findById(current._id);
      const data = safeFields(expected);
      doc.set(data);
      // Campos de auditoría que el backup no tiene: se conservan.
      await doc.save();
    }
  }

  console.log('\nModo:', APPLY ? 'APLICADO' : 'simulación (--apply para escribir)');
  await client.close();
  if (APPLY) await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
