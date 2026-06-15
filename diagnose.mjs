// Temporary diagnostic — run with: node diagnose.mjs
// Reads Travel_Plans_Yana.xlsx and reports bad names that slipped through the filters.

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { parseXlsxWorkbookDebug } from './src/utils/xlsxImport.js';

const FILE = 'C:/Users/MY PC/Downloads/Travel Plans Yana.xlsx';
const wb = XLSX.read(readFileSync(FILE));
const candidates = parseXlsxWorkbookDebug(wb);

const accepted  = candidates.filter(c => c.accepted);
const rejected  = candidates.filter(c => !c.accepted);

console.log(`\nTotal candidates : ${candidates.length}`);
console.log(`Accepted         : ${accepted.length}`);
console.log(`Rejected (filtered out): ${rejected.length}`);

// ── Suspicious patterns in accepted names ─────────────────────────────────────
const CHECKS = [
  { label: 'Starts with "("',           test: s => s.startsWith('(') },
  { label: 'Pure time / time-range',    test: s => /^\(?\d{1,2}[: h]\d{2}/.test(s) || /^\d{1,2}\s*(am|pm)/i.test(s) },
  { label: '3-letter code + anything',  test: s => /^[A-Z]{3}[\s-]/.test(s) },
  { label: 'Ends with " -" (fragment)', test: s => /\s-$/.test(s) },
  { label: 'All-caps 2-4 letter code',  test: s => /^[A-Z]{2,4}$/.test(s) },
];

let anyBad = false;
for (const check of CHECKS) {
  const hits = accepted.filter(c => check.test(c.cleaned));
  if (!hits.length) continue;
  anyBad = true;
  console.log(`\n── ${check.label} (${hits.length}) ──────────────────────────`);
  for (const h of hits) {
    const rawNote = h.cleaned !== h.raw ? `  raw: "${h.raw}"` : '';
    console.log(`  "${h.cleaned}"   [${h.sheet} / ${h.path} / ${h.city}]${rawNote}`);
  }
}
if (!anyBad) console.log('\n✓ No suspicious patterns found in accepted names.');

// ── Full accepted list grouped by sheet / path ────────────────────────────────
console.log('\n\n══ ALL ACCEPTED NAMES BY SHEET ══════════════════════════════════');
const grouped = {};
for (const c of accepted) {
  const key = `${c.sheet}  [${c.path}]  city:${c.city}`;
  (grouped[key] = grouped[key] || []).push(c.cleaned);
}
for (const [key, names] of Object.entries(grouped)) {
  console.log(`\n── ${key}`);
  names.forEach(n => console.log(`   ${n}`));
}
