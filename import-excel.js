require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const XLSX = require('@e965/xlsx');
const Material = require('./models/Material');

const MONGODB_URI = process.env.MONGODB_URI;
const DATA_DIR = 'C:/Users/USUARIO/Documents/My Proyects/Custom Apps/Cotizador SV';

function cleanPrice(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let s = String(val).replace('$', '').trim();
  if (s.includes('.') && s.split('.')[1].length <= 2) {
    const n = parseFloat(s.replace(',', ''));
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function mapUnit(u) {
  if (!u) return 'UNIDAD';
  const map = { UND: 'UNIDAD', ML: 'ML', JUEGO: 'JUEGO', PAR: 'UNIDAD', TIRO: 'TIRO', UNIDAD: 'UNIDAD' };
  return map[String(u).trim().toUpperCase()] || 'UNIDAD';
}

async function importHerraje() {
  console.log('\n=== IMPORTANDO HERRAJES ===');
  const wb = XLSX.readFile(path.join(DATA_DIR, 'LISTADO DE MATERIAS PRIMAS  (2).xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const bulk = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const code = r[3] ? String(r[3]).trim() : '';
    const desc = r[4] ? String(r[4]).trim() : '';
    if (!desc) continue;
    bulk.push({
      category: 'herraje',
      code,
      description: desc,
      provider: r[1] ? String(r[1]).trim() : '',
      color: '',
      dimension: '',
      unit: mapUnit(r[6]),
      unitPrice: cleanPrice(r[7]),
      laborMinutes: r[8] ? parseFloat(String(r[8]).replace(',', '.')) || 0 : 0,
      active: true
    });
  }

  if (bulk.length) {
    await Material.insertMany(bulk);
    console.log(`  ${bulk.length} herrajes insertados`);
  }
  return bulk.length;
}

async function importMesonesGranito() {
  console.log('\n=== IMPORTANDO MESONES (GRANITO) ===');
  const wb = XLSX.readFile(path.join(DATA_DIR, 'PRECIO MESONES PARA COTIZADOR.xlsx'));
  const ws = wb.Sheets['PRECIO MESONES GRANITO'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const seen = new Set();
  const bulk = [];
  let started = false;
  let firstSectionDone = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (String(r[0]).trim() === 'NOMBRE GRANITO') {
      if (firstSectionDone) break;
      started = true; continue;
    }
    if (String(r[0]).trim().startsWith('VALORES PARA')) {
      if (started) firstSectionDone = true;
      started = false; continue;
    }
    if (!started) continue;
    const name = r[0] ? String(r[0]).trim() : '';
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const provider = r[10] ? String(r[10]).trim() : 'ROCA MARMOL';
    bulk.push({
      category: 'meson',
      code: '',
      description: name,
      provider,
      color: '',
      dimension: '',
      unit: 'M2',
      unitPrice: cleanPrice(r[1]),
      active: true
    });
  }

  if (bulk.length) {
    await Material.insertMany(bulk);
    console.log(`  ${bulk.length} mesones (granito) insertados`);
  }
  return bulk.length;
}

async function importCompac() {
  console.log('\n=== IMPORTANDO COMPAC ===');
  const wb = XLSX.readFile(path.join(DATA_DIR, 'PRECIO MESONES PARA COTIZADOR.xlsx'));
  const ws = wb.Sheets['COMPAC'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const bulk = [];
  let inProductSection = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (r[0] === 'PRODUCTO' && r[3] === 'REFERENCIA') { inProductSection = true; continue; }
    if (r[0] === 'REF. COLOR') { inProductSection = false; continue; }
    if (!inProductSection) continue;
    const ref = r[3] ? String(r[3]).trim() : '';
    if (!ref) continue;
    const product = r[0] ? String(r[0]).trim() : '';
    const dimension = r[1] ? String(r[1]).trim() : '';
    const core = r[6] ? String(r[6]).trim() : '';
    const finish = r[4] ? String(r[4]).trim() : '';
    const desc = `${product} ${ref} ${dimension}${finish ? ' ' + finish : ''}${core ? ' ' + core : ''}`.trim();
    bulk.push({
      category: 'compactslab',
      code: ref,
      description: desc,
      provider: 'LAMITECH',
      color: core,
      dimension,
      unit: 'M2',
      unitPrice: cleanPrice(r[9]),
      pricePerSheet: cleanPrice(r[7]),
      measure1: parseFloat(String(dimension.split('x')[0]).trim()) || 0,
      measure2: parseFloat(String(dimension.split('x')[1]).trim()) || 0,
      active: true
    });
  }

  if (bulk.length) {
    await Material.insertMany(bulk);
    console.log(`  ${bulk.length} compactslab insertados`);
  }
  return bulk.length;
}

async function main() {
  if (!MONGODB_URI) { console.error('ERROR: MONGODB_URI no definida'); process.exit(1); }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');
    // Limpiar todas las categorías antes de importar
    await Material.deleteMany({ category: { $in: ['herraje', 'meson', 'compactslab'] } });
    console.log('Registros anteriores eliminados');
    const h = await importHerraje();
    const m = await importMesonesGranito();
    const c = await importCompac();
    console.log(`\n=== TOTAL: ${h + m + c} materiales insertados ===`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado');
  }
}

main();