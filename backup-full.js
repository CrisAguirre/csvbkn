/**
 * backup-full.js — Copia de seguridad COMPLETA de MongoDB (todas las colecciones)
 * Uso:
 *   $env:MONGODB_URI="mongodb+srv://..."; node backup-full.js
 *   node backup-full.js "mongodb+srv://..."
 *
 * Genera: backups/backup-YYYY-MM-DD_HH-mm-ss.json + resumen por consola.
 * No borra nada, solo lectura (find().lean()).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const Material = require('./models/Material');
const LaborTime = require('./models/LaborTime');
const Config = require('./models/Config');
const User = require('./models/User');
const Quotation = require('./models/Quotation');
const Temporal = require('./models/Temporal');
const ManualEntry = require('./models/ManualEntry');
const Activity = require('./models/Activity');

const MONGODB_URI = process.env.MONGODB_URI || process.argv[2];

function clean(docs) {
  return docs.map((d) => {
    const o = { ...d };
    if (o._id && typeof o._id !== 'string') o._id = o._id.toString();
    delete o.__v;
    return o;
  });
}

async function main() {
  if (!MONGODB_URI) {
    console.error('ERROR: define MONGODB_URI como variable de entorno o como argumento.');
    console.error('Ej: $env:MONGODB_URI="mongodb+srv://..."; node backup-full.js');
    process.exit(1);
  }

  const outDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // Hora local America/Bogota aprox (UTC-5) para nombre de archivo legible
  const stamp =
    `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}` +
    `_${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}`;
  const outFile = path.join(outDir, `backup-${stamp}.json`);

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('Conectado a MongoDB:', mongoose.connection.name);

    const collections = {
      materials: Material,
      laborTimes: LaborTime,
      configs: Config,
      users: User,
      quotations: Quotation,
      temporals: Temporal,
      manualEntries: ManualEntry,
      activities: Activity,
    };

    const data = { exportedAt: new Date().toISOString(), dbName: mongoose.connection.name, counts: {} };
    for (const [key, Model] of Object.entries(collections)) {
      try {
        const docs = await Model.find({}).lean();
        data[key] = clean(docs);
        data.counts[key] = docs.length;
        console.log(`  - ${key}: ${docs.length}`);
      } catch (e) {
        console.error(`  ! Error exportando ${key}: ${e.message}`);
        data[key] = [];
        data.counts[key] = 0;
      }
    }

    // No guardar password hash de usuarios en texto plano del log, pero sí en backup (necesario para restaurar).
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
    const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
    console.log(`\nBackup completado: ${outFile} (${sizeMb} MB)`);
  } catch (err) {
    console.error('Error de backup:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

main();
