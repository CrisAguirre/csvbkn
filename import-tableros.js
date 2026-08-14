require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('@e965/xlsx');
const Material = require('./models/Material');

const MONGODB_URI = process.env.MONGODB_URI;
const FILE = 'C:/Users/USUARIO/Documents/My Proyects/Custom Apps/Cotizador SV/LISTADO DE TABLEROS.xlsx';

const META_GROUPS = ['REFERENCIAS DISP', 'REFERENCIAS NUEVAS', 'EST BLANCO', 'RH BLANCO'];

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

function categoryFor(provider, desc) {
  const p = provider.toUpperCase();
  if (p.includes('REHAU')) return 'tablero';
  const d = desc.toUpperCase();
  if (d.includes('DURAOPAK')) return 'duraopak';
  if (d.includes('LAMINADO')) return 'laminado';
  if (d.includes('MELAMINA')) return 'melamina';
  return 'otro';
}

function colorGroup(raw) {
  const c = clean(raw).toUpperCase();
  if (!c || c === 'NA' || META_GROUPS.includes(clean(raw).toUpperCase())) return '';
  return clean(raw);
}

async function main() {
  if (!MONGODB_URI) { console.error('ERROR: MONGODB_URI no definida'); process.exit(1); }
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

let created = 0;
  let updated = 0;
  const byCat = {};
  const preview = [];

  for (const r of rows) {
    const provider = clean(r.PROVEEDOR);
    const desc = clean(r.REFERENCIA);
    const color = colorGroup(r['GRUPO DE COLOR']);
    if (!desc) continue;

    const category = categoryFor(provider, desc);
    const pricePerSqm = num(r['PRECIO POR M2']);
    const sqmPerSheet = num(r.M2);
    const laborMinutes = num(r['M.O POR M2\n(MINUTOS)']);

    const doc = {
      category,
      code: slug(desc),
      description: desc,
      provider,
      brand: clean(r.MARCA),
      color,
      dimension: '',
      unit: 'LAMINA',
      pricePerSqm,
      sqmPerSheet,
      pricePerSheet: sqmPerSheet * pricePerSqm,
      laborMinutes,
      active: true
    };

    const key = `${provider}||${desc}||${color}`;
    void key;

    if (process.env.DRY_RUN) {
      preview.push(`${category.padEnd(10)} | ${provider.padEnd(18)} | ${color.padEnd(10)} | ${String(pricePerSqm).padStart(8)}/m² | ${desc}`);
      continue;
    }

    const existing = await Material.findOneAndUpdate(
      { code: doc.code, provider, color },
      doc,
      { new: true }
    );
    if (existing) { updated++; } else {
      await Material.create(doc);
      created++;
    }
    byCat[category] = (byCat[category] || 0) + 1;
  }

  if (process.env.DRY_RUN) {
    console.log('=== PREVIEW (dry-run) — ' + preview.length + ' registros mapeados ===');
    preview.forEach(p => console.log(p));
    console.log('Por categoría:', preview.reduce((acc, p) => { const c = p.split('|')[0].trim(); acc[c] = (acc[c] || 0) + 1; return acc; }, {}));
    await mongoose.disconnect();
    console.log('Dry-run: NO se escribió nada en la BD.');
    return;
  }

  console.log('=== RESULTADO ===');
  console.log('Creados:', created, '| Actualizados:', updated);
  console.log('Por categoría:', byCat);

  await mongoose.disconnect();
  console.log('Desconectado');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });