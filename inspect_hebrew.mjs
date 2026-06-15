// Temporary inspection — dumps raw rows for Hebrew table sheets
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const FILE = 'C:/Users/MY PC/Downloads/Travel Plans Yana.xlsx';
const wb = XLSX.read(readFileSync(FILE));

const HEB_DAY = {
  'שבת': 'sat', 'ראשון': 'sun', 'שני': 'mon',
  'שלישי': 'tue', 'רביעי': 'wed', 'חמישי': 'thu', 'שישי': 'fri',
};

function inspectSheet(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.log(`Sheet "${sheetName}" not found`); return; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SHEET: "${sheetName}"  (${rows.length} rows total)`);

  // Find header row with Hebrew day names
  let headerRow = -1;
  outer:
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = String(rows[r][c] || '').trim();
      for (const heb of Object.keys(HEB_DAY)) {
        if (cell.startsWith(heb)) {
          headerRow = r;
          console.log(`\n  Header row: ${r}  (col ${c} = "${cell}")`);
          break outer;
        }
      }
    }
  }

  if (headerRow < 0) {
    console.log('  No Hebrew header found!');
    // Print first 15 rows anyway
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r];
      const cols = row.map((v, i) => `[${i}]=${JSON.stringify(v)}`).join('  ');
      console.log(`  row${r}: ${cols || '(empty)'}`);
    }
    return;
  }

  // Print the header row fully
  console.log(`\n  HEADER ROW ${headerRow}:`);
  rows[headerRow].forEach((v, i) => {
    if (String(v).trim()) console.log(`    col[${i}] = ${JSON.stringify(v)}`);
  });

  // Print next 15 data rows with ALL columns
  console.log(`\n  DATA ROWS (${headerRow + 1} onwards):`);
  for (let r = headerRow + 1; r < Math.min(headerRow + 16, rows.length); r++) {
    const row = rows[r];
    const cols = row
      .map((v, i) => ({ i, v: String(v).trim() }))
      .filter(x => x.v)
      .map(x => `[${x.i}]=${JSON.stringify(x.v)}`)
      .join('  ');
    console.log(`  row${r}: ${cols || '(all empty)'}`);
  }
}

inspectSheet('Bucharest JUN 2024');
inspectSheet('Krakow + Warsaw Apr 2024');
