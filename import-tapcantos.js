require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Material = require('./models/Material');

const MONGODB_URI = process.env.MONGODB_URI;
const FILE = process.env.TAPCANTOS_FILE || 'C:/Users/USUARIO/Desktop/Cotizador SV/PRECIO Y M.O TAPACANTOS.xlsx';

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function num(v) {
  if (v === undefined || v === null) return 0;
  const s = clean(v).replace(/\s/g, '').replace(',', '.');
  return Number(s) || 0;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseMo(v) {
  const n = num(v);
  return n > 0 ? n : 3;
}

// Columnas: A(col0) vacía | B(col1)=calibre/desc o tipo de grupo | C(col2)=precio o rigidez | D(col3)=tiempo MO/ML
function buildMaterials() {
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const materials = [];
  let groupTipo = '';
  let groupRigidez = '';

  for (const row of rows) {
    const colB = clean(row[1]);
    const colC = clean(row[2]);
    const colD = clean(row[3]); // tiempo M.O/ML (presente=3 en ítems, vacío en filas de grupo)
    const precio = num(colC);

    if (!colB && !colC) continue; // fila vacía

    // Fila de grupo: la columna de tiempo (D) viene vacía. B=tipo, C=rigidez
    if (colD === '') {
      groupTipo = colB.toUpperCase();
      groupRigidez = colC.toUpperCase();
      continue;
    }

    if (!colB || !precio) continue;

    const esBrillante = groupTipo.includes('BRILLANTES');
    const rigidez = esBrillante
      ? 'semirigido'
      : groupRigidez.toUpperCase().includes('FLEXIBLE')
        ? 'flexible'
        : groupRigidez.toUpperCase().includes('RIGIDO')
          ? 'rigido'
          : slug(groupRigidez);

    materials.push({
      category: 'canto',
      code: esBrillante
        ? slug(`canto-${colB}`)
        : slug(`canto-${colB}-${groupTipo}-${rigidez}`),
      description: esBrillante
        ? `TAPACANTO ${colB} (BRILLANTES Y BICOLOR)`
        : `TAPACANTO ${colB} ${groupTipo} ${rigidez}`,
      provider: 'TAPACANTOS',
      brand: '',
      color: groupTipo,
      dimension: colB,
      unit: 'ML',
      unitPrice: precio,
      active: true,
      rigidez,
      tipo: esBrillante ? 'brillantesbicolor' : slug(groupTipo),
      calibre: esBrillante ? '' : colB,
      moMinutesPerMl: parseMo(colD)
    });
  }

  return materials;
}

async function main() {
  const materials = buildMaterials();

  console.log('== REGISTROS PARSEADOS (' + materials.length + ') ==');
  materials.forEach((m) =>
    console.log(
      'canto | ' +
        (m.calibre || m.description).padEnd(14) +
        ' | ' + m.tipo.padEnd(16) +
        ' | ' + (m.rigidez ? m.rigidez + ' ' : '').padEnd(10) +
        ' | $' + m.unitPrice +
        '/ML | MO ' + m.moMinutesPerMl + ' min'
    )
  );

  if (process.env.DRY_RUN) {
    console.log('\n=== DRY-RUN: NO se escribió nada en la BD ===');
    process.exit(0);
  }

  if (!MONGODB_URI) { console.error('ERROR: MONGODB_URI no definida'); process.exit(1); }
  await mongoose.connect(MONGODB_URI);
  console.log('\nConectado a MongoDB');

  let created = 0;
  let updated = 0;
  for (const doc of materials) {
    const existing = await Material.findOneAndUpdate({ code: doc.code }, doc, { new: true });
    if (existing) updated++;
    else { await Material.create(doc); created++; }
  }

  console.log('=== RESULTADO ===');
  console.log('Creados:', created, '| Actualizados:', updated);

  await mongoose.disconnect();
  console.log('Desconectado');
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });