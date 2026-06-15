// Temporary — list all type='other' places from the parser to spot non-venue names.
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { parseXlsxWorkbook } from './src/utils/xlsxImport.js';

const FILE = 'C:/Users/MY PC/Downloads/Travel Plans Yana.xlsx';
const wb = XLSX.read(readFileSync(FILE));
const { places } = parseXlsxWorkbook(wb);

const others = places.filter(p => p.type === 'other');
const accoms = places.filter(p => p.type === 'accommodation');

console.log(`\nTotal parsed: ${places.length}`);
console.log(`  accommodation: ${accoms.length}`);
console.log(`  other:         ${others.length}`);
console.log(`  (rest have explicit types from structured sheets)\n`);

const byCity = {};
for (const p of others) {
  (byCity[p.city] = byCity[p.city] || []).push(p.name);
}
console.log('── TYPE=OTHER BY CITY ──────────────────────────────────────────');
for (const [city, names] of Object.entries(byCity).sort()) {
  console.log(`\n${city.toUpperCase()} (${names.length})`);
  names.forEach(n => console.log(`  ${n}`));
}

console.log('\n── ACCOMMODATION (for reference) ───────────────────────────────');
accoms.forEach(p => console.log(`  [${p.city}] ${p.name}`));
