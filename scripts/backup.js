#!/usr/bin/env node
/**
 * Backup completo de MongoDB (Fase 0).
 *
 * - Exporta TODAS las colecciones en formato EJSON (preserva ObjectId, Date, Decimal128, etc.).
 * - Guarda tambien los indices de cada coleccion (sin ellos se pierden las restricciones unique).
 * - Comprime con gzip y cifra con AES-256-GCM.
 * - Genera manifest.json con conteos, hashes y tamanos para poder verificar la restauracion.
 *
 * Uso:
 *   BACKUP_PASSPHRASE="..." node scripts/backup.js --out "C:\ruta\carpeta"
 *
 * La clave puede venir en BACKUP_PASSPHRASE o pedirse por consola.
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

const MAGIC = Buffer.from('SPZBAK01'); // 8 bytes
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const FORMAT = 'spaziovitale-backup/1';

function parseArgs(argv) {
  const args = { out: null, key: process.env.BACKUP_PASSPHRASE || '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (a === '--key' && argv[i + 1]) args.key = argv[++i];
  }
  return args;
}

async function askPassphrase() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('Clave de cifrado del backup: ', resolve));
  rl.close();
  return answer.trim();
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Hash del conjunto de _id (ordenado) para verificar que se restauraron los mismos documentos. */
function idsHash(ids) {
  const sorted = ids.map((id) => String(id)).sort();
  return sha256(Buffer.from(sorted.join('\n')));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI (definela en .env o en el entorno).');
    process.exit(1);
  }

  const passphrase = args.key || (await askPassphrase());
  if (!passphrase || passphrase.length < 12) {
    console.error('La clave debe tener al menos 12 caracteres.');
    process.exit(1);
  }

  const startedAt = new Date();
  const defaultOut = path.resolve(__dirname, '..', 'backups', stamp(startedAt));
  const outDir = path.resolve(args.out || defaultOut);
  fs.mkdirSync(outDir, { recursive: true });

  const archiveName = 'backup.ndjson.gz.enc';
  const archivePath = path.join(outDir, archiveName);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'test';
  const db = client.db(dbName);

  const listed = await db.listCollections({}, { nameOnly: true }).toArray();
  const collections = listed
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort();

  if (collections.length === 0) {
    console.error('No hay colecciones para exportar.');
    await client.close();
    process.exit(1);
  }

  // Indices ANTES de exportar: si falla, no escribimos un backup "valido" incompleto.
  const indexes = {};
  for (const name of collections) {
    indexes[name] = (await db.collection(name).indexes()).filter((ix) => ix.name !== '_id_');
  }

  const stats = {};
  for (const name of collections) {
    stats[name] = { count: 0, hash: crypto.createHash('sha256'), ids: [] };
  }

  let totalDocs = 0;

  async function* source() {
    for (const name of collections) {
      const cursor = db.collection(name).find({}, { batchSize: 500 });
      for await (const doc of cursor) {
        const line = `${EJSON.stringify({ c: name, d: doc }, { relaxed: false })}\n`;
        const buf = Buffer.from(line, 'utf8');
        stats[name].hash.update(buf);
        stats[name].ids.push(doc._id);
        stats[name].count += 1;
        totalDocs += 1;
        yield buf;
      }
    }
  }

  // Cifrado
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  fs.writeFileSync(archivePath, Buffer.concat([MAGIC, salt, iv, Buffer.alloc(TAG_LEN)]));

  const out = fs.createWriteStream(archivePath, { flags: 'a' });
  await pipeline(source(), zlib.createGzip({ level: 9 }), cipher, out);

  const tag = cipher.getAuthTag();
  const fh = await fs.promises.open(archivePath, 'r+');
  await fh.write(tag, 0, TAG_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  await fh.close();

  const archive = await fs.promises.readFile(archivePath);
  const manifest = {
    format: FORMAT,
    createdAt: startedAt.toISOString(),
    host: new URL(uri).host,
    database: dbName,
    encryption: { algorithm: 'aes-256-gcm', kdf: 'scrypt', saltBytes: SALT_LEN, ivBytes: IV_LEN },
    archive: { file: archiveName, bytes: archive.length, sha256: sha256(archive) },
    totals: { collections: collections.length, documents: totalDocs },
    collections: collections.map((name) => ({
      name,
      count: stats[name].count,
      ndjsonSha256: stats[name].hash.digest('hex'),
      idsSha256: idsHash(stats[name].ids),
      indexes: indexes[name]
    }))
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const readme = [
    'COPIA DE SEGURIDAD — Spazio Vitales',
    '',
    `Fecha:      ${startedAt.toISOString()}`,
    `Base:       ${dbName}`,
    `Colecciones:${collections.length}   Documentos: ${totalDocs}`,
    `Archivo:    ${archiveName}`,
    `SHA-256:    ${manifest.archive.sha256}`,
    '',
    'El contenido esta cifrado (AES-256-GCM) porque incluye datos de clientes y hashes de contrasenas.',
    'La clave NO se guarda en esta carpeta. Conservela en un gestor de contrasenas.',
    '',
    'Restaurar (siempre sobre una base distinta a la de produccion):',
    '  BACKUP_PASSPHRASE="..." node scripts/restore.js \\',
    '    --file "<esta carpeta>\\backup.ndjson.gz.enc" \\',
    '    --db spaziovitale_restore --dry-run',
    '',
    'Verificar sin escribir:',
    '  ... --db spaziovitale_verificacion --dry-run',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'LEEME.txt'), readme);

  await client.close();

  console.log('');
  console.log(`Backup OK -> ${outDir}`);
  console.log(`Colecciones: ${collections.length} | Documentos: ${totalDocs} | ${(archive.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`SHA-256: ${manifest.archive.sha256}`);
  for (const c of manifest.collections) {
    console.log(`  - ${c.name.padEnd(16)} ${String(c.count).padStart(6)} docs, ${c.indexes.length} indices`);
  }
}

main().catch((err) => {
  console.error('Backup FALLIDO:', err.message);
  process.exit(1);
});
