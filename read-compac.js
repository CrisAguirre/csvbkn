const XLSX = require('@e965/xlsx');
const wb = XLSX.readFile('C:/Users/USUARIO/Desktop/Spazzzio/PRECIO MESONES PARA COTIZADOR.xlsx');

const ws = wb.Sheets['COMPAC'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('Total rows:', rows.length);
for (let i = 40; i < Math.min(rows.length, 112); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}
