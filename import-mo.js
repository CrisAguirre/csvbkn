require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const LaborTime = require('./models/LaborTime');

const MONGODB_URI = process.env.MONGODB_URI;
const DIR = 'C:/Users/USUARIO/Documents/My Proyects/Custom Apps/Cotizador SV';
const FILES = [
  { file: `${DIR}/LISTADO M.O ARMADO.xlsx`, category: 'armado' },
  { file: `${DIR}/LISTADO M.O INSTALACIÓN.xlsx`, category: 'instalacion' }
];

function num(v) {
  if (v === undefined || v === null) return 0;
  return Number(v) || 0;
}

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function unitOfMeasure(u) {
  const un = clean(u).toUpperCase();
  if (['ML', 'M2', 'UNIDAD', 'LAMINA', 'SERVICIO'].includes(un)) return un;
  return 'UNIDAD';
}

async function main() {
  if (!MONGODB_URI) { console.error('ERROR: MONGODB_URI no definida'); process.exit(1); }
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  let created = 0;
  let updated = 0;
  const byCat = {};

  for (const { file, category } of FILES) {
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    for (const r of rows) {
      const desc = clean(r.DESCRIPCIÓN);
      if (!desc) continue;

      const minutes = num(r.TIEMPOS);
      const valorMinuto = num(r['VALOR MINUTO ']) || num(r['VALOR MINUTO']);
      const persons = category === 'instalacion' ? (num(r['N° DE OPERARIOS ']) || num(r['N° DE OPERARIOS']) || 1) : 1;
      const quantity = num(r.CANTIDAD) || 1;

      const doc = {
        code: `${category}-${slug(desc)}`,
        activityName: desc,
        timeHours: minutes / 60,
        category,
        minutes,
        valorMinuto,
        persons,
        quantity,
        unit: unitOfMeasure(r['UNIDAD DE MEDIDAD'] || r['UNIDAD DE MEDIDA']),
        isService: true,
        active: true
      };

      if (process.env.DRY_RUN) {
        console.log(`[${category}] ${minutes}min · $${valorMinuto}/min · ${persons} op · ${doc.unit} | ${desc}`);
        continue;
      }

      const existing = await LaborTime.findOneAndUpdate(
        { code: doc.code },
        doc,
        { new: true }
      );
      if (existing) { updated++; } else {
        await LaborTime.create(doc);
        created++;
      }
      byCat[category] = (byCat[category] || 0) + 1;
    }
  }

  if (process.env.DRY_RUN) {
    console.log('=== PREVIEW (dry-run) — NO se escribió nada en la BD ===');
    console.log('Por categoría:', byCat);
    await mongoose.disconnect();
    return;
  }

  console.log('=== RESULTADO ===');
  console.log('Creados:', created, '| Actualizados:', updated);
  console.log('Por categoría:', byCat);

  await mongoose.disconnect();
  console.log('Desconectado');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
