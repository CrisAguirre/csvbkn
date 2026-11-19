#!/usr/bin/env node
/**
 * Restauracion / verificacion de un backup cifrado generado por scripts/backup.js
 *
 * Modos:
 *   --dry-run   Solo descifra y cuenta. No escribe en la base. Sirve para comprobar
 *               que el archivo esta integro y que la clave es correcta.
 *   (sin flag)  Restaura de verdad. Exige --yes y una base destino distinta a la original.
 *
 * Uso:
 *   BACKUP_PASSPHRASE="..." node scripts/restore.js --file "<carpeta>\backup.ndjson.gz.enc" \
 *     --db spaziovitale_verificacion --dry-run
 *
 *   BACKUP_PASSPHRASE="..." node scripts/restore.js --file "..." \
 *     --db spaziovitale_restore --yes [--drop]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
const { pipeline } = require('stream/promises');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const MAGIC = Buffer.from('SPZBAK01');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN;
const BATCH = 500;

function parseArgs(argv) {
  const args = {
    file: null, db: null, key: process.env.BACKUP_PASSPHRASE || '',
    dryRun: false, yes: false, drop: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) args.file = argv[++i];
    else if (a === '--db' && argv[i + 1]) args.db = argv[++i];
    else if (a === '--key' && argv[i + 1]) args.key = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--yes') args.yes = true;
    else if (a === '--drop') args.drop = true;
  }
  return args;
}

async function askPassphrase() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('Clave de cifrado del backup: ', resolve));
  rl.close();
  return answer.trim();
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function idsHash(ids) {
  return sha256(Buffer.from(ids.map((id) => String(id)).sort().join('\n')));
}

/** Divide el stream en lineas conservando caracteres multibyte entre chunks. */
async function* readLines(stream) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (line.trim()) yield line;
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Falta --file <ruta del backup.ndjson.gz.enc>');
    process.exit(1);
  }
  if (!args.db) {
    console.error('Falta --db <base destino>. Nunca restaures sobre la base de produccion.');
    process.exit(1);
  }

  const file = path.resolve(args.file);
  const dir = path.dirname(file);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) {
    console.error(`No existe el archivo: ${file}`);
    process.exit(1);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`No existe manifest.json junto al backup: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (args.db === manifest.database) {
    console.error(`La base destino "${args.db}" es la misma del backup. Abortado.`);
    process.exit(1);
  }

  const passphrase = args.key || (await askPassphrase());
  if (!passphrase) {
    console.error('Clave vacia.');
    process.exit(1);
  }

  // Cabecera
  const fh = await fs.promises.open(file, 'r');
  const header = Buffer.alloc(HEADER_LEN);
  await fh.read(header, 0, HEADER_LEN, 0);
  await fh.close();
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    console.error('El archivo no tiene el formato esperado.');
    process.exit(1);
  }
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = header.subarray(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  const tag = header.subarray(MAGIC.length + SALT_LEN + IV_LEN, HEADER_LEN);

  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI.');
    process.exit(1);
  }

  if (!args.dryRun && !args.yes) {
    console.error('Escritura no confirmada. Anada --yes para restaurar de verdad, o use --dry-run.');
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db(args.db);

  if (args.drop) {
    for (const c of manifest.collections) {
      await db.collection(c.name).drop().catch(() => {});
    }
    console.log(`Colecciones destino vaciadas en "${args.db}".`);
  }

  const counts = {};
  const ids = {};
  const byCollection = new Map(); // name -> batch[]

  async function flush(name) {
    const batch = byCollection.get(name) || [];
    if (batch.length === 0) return;
    await db.collection(name).insertMany(batch, { ordered: false });
    byCollection.set(name, []);
  }

  const readStream = fs.createReadStream(file, { start: HEADER_LEN });
  const gunzip = zlib.createGunzip();
  let streamError = null;
  const streamDone = pipeline(readStream, decipher, gunzip).catch((err) => { streamError = err; });
  let processed = 0;

  for await (const line of readLines(gunzip)) {
    const { c, d } = EJSON.parse(line, { relaxed: false });
    if (!counts[c]) { counts[c] = 0; ids[c] = []; byCollection.set(c, []); }
    counts[c] += 1;
    ids[c].push(d._id);
    processed += 1;

    if (!args.dryRun) {
      const batch = byCollection.get(c);
      batch.push(d);
      if (batch.length >= BATCH) await flush(c);
    } else if (processed % 2000 === 0) {
      process.stdout.write(`\rDescifrados: ${processed}`);
    }
  }
  await streamDone;
  if (streamError) throw streamError;
  if (args.dryRun) process.stdout.write('\r');

  if (!args.dryRun) {
    for (const name of byCollection.keys()) await flush(name);

    // Indices: sin esto se pierden las restricciones unique (numero de cotizacion, email, etc.)
    for (const c of manifest.collections) {
      if (!c.indexes || c.indexes.length === 0) continue;
      await db.collection(c.name).createIndexes(c.indexes);
    }

    // Verificacion real contra la base destino
    for (const c of manifest.collections) {
      const col = db.collection(c.name);
      counts[c.name] = await col.countDocuments();
      ids[c.name] = await col.find({}, { projection: { _id: 1 } }).toArray().then((r) => r.map((x) => x._id));
    }
  }

  await client.close();

  // Comparacion contra el manifiesto
  let ok = true;
  console.log('');
  console.log(`${'Coleccion'.padEnd(18)} ${'manifest'.padStart(9)} ${'obtenido'.padStart(9)}  estado`);
  for (const c of manifest.collections) {
    const got = counts[c.name] || 0;
    const sameCount = got === c.count;
    const sameIds = idsHash(ids[c.name] || []) === c.idsSha256;
    const state = sameCount && sameIds ? 'OK' : 'DIFERENTE';
    if (state !== 'OK') ok = false;
    console.log(`${c.name.padEnd(18)} ${String(c.count).padStart(9)} ${String(got).padStart(9)}  ${state}`);
  }

  console.log('');
  console.log(args.dryRun
    ? `DRY-RUN: ${processed} documentos descifrados y verificados contra el manifiesto.`
    : `RESTAURACION: ${processed} documentos insertados en "${args.db}" e indices recreados.`);
  console.log(ok ? 'Integridad: OK (conteos y hashes de _id coinciden).' : 'Integridad: ERROR. No usar esta restauracion.');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('\nRestauracion FALLIDA:', err.message);
  process.exit(1);
});
