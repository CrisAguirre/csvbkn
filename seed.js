require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const Material = require('./models/Material');
const LaborTime = require('./models/LaborTime');
const Config = require('./models/Config');

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_FILE = path.join(__dirname, '..', 'scripts', 'seed-data.json');

async function runExport() {
  console.log('Exportando datos desde MongoDB...');

  const materials = await Material.find({}).lean();
  const laborTimes = await LaborTime.find({}).lean();
  const configs = await Config.find({}).lean();

  const data = {
    exportedAt: new Date().toISOString(),
    materials: materials.map(m => ({ ...m, _id: m._id.toString(), __v: undefined })),
    laborTimes: laborTimes.map(l => ({ ...l, _id: l._id.toString(), __v: undefined })),
    configs: configs.map(c => ({ ...c, _id: c._id.toString(), __v: undefined }))
  };

  fs.writeFileSync(SEED_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Exportación completada: ${SEED_FILE}`);
  console.log(`  - Materiales:     ${data.materials.length}`);
  console.log(`  - Tiempos MO:     ${data.laborTimes.length}`);
  console.log(`  - Configuraciones: ${data.configs.length}`);
}

async function runImport() {
  if (!fs.existsSync(SEED_FILE)) {
    console.error(`ERROR: No se encuentra el archivo ${SEED_FILE}`);
    process.exit(1);
  }

  console.log('Importando datos a MongoDB...');
  const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

  await Material.deleteMany({});
  await LaborTime.deleteMany({});
  await Config.deleteMany({});

  if (data.materials.length) await Material.insertMany(data.materials);
  if (data.laborTimes.length) await LaborTime.insertMany(data.laborTimes);
  if (data.configs.length) await Config.insertMany(data.configs);

  console.log(`Importación completada desde ${SEED_FILE}`);
  console.log(`  - Materiales:     ${data.materials.length}`);
  console.log(`  - Tiempos MO:     ${data.laborTimes.length}`);
  console.log(`  - Configuraciones: ${data.configs.length}`);
}

async function main() {
  const command = process.argv[2] || 'export';

  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI no está definida en las variables de entorno.');
    console.error('Asegúrate de que csvbkn/.env existe y contiene MONGODB_URI.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    if (command === 'export') {
      await runExport();
    } else if (command === 'import') {
      await runImport();
    } else {
      console.error('Comando no reconocido. Usa: export | import');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

main();