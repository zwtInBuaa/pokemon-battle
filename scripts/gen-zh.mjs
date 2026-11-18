// Generates src/data/zh.json (Chinese names) from PokeAPI CSV datasets.
// Run: node scripts/gen-zh.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const ZH = 12; // local_language_id for zh-Hans

async function fetchCSV(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`fetch ${name} -> ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

// Minimal CSV parser handling quoted fields with commas/escaped quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length >= header.length).map(r => {
    const o = {};
    header.forEach((h, idx) => { o[h.trim()] = r[idx]; });
    return o;
  });
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  console.log('Downloading PokeAPI CSVs...');
  const [speciesNames, moves, moveNames, abilities, abilityNames, items, itemNames] = await Promise.all([
    fetchCSV('pokemon_species_names.csv'),
    fetchCSV('moves.csv'),
    fetchCSV('move_names.csv'),
    fetchCSV('abilities.csv'),
    fetchCSV('ability_names.csv'),
    fetchCSV('items.csv'),
    fetchCSV('item_names.csv'),
  ]);
  console.log('Downloaded. Joining...');

  // species: num -> zh name
  const species = {};
  for (const r of speciesNames) {
    if (+r.local_language_id === ZH && r.name) species[+r.pokemon_species_id] = r.name;
  }

  // generic join: id->identifier map + names(id,lang,name)
  function joinNames(idRows, nameRows, idKey, nameKey) {
    const idMap = {};
    for (const r of idRows) idMap[r.id] = norm(r.identifier);
    const out = {};
    for (const r of nameRows) {
      if (+r.local_language_id !== ZH || !r.name) continue;
      const key = idMap[r[idKey]];
      if (key) out[key] = r.name;
    }
    return out;
  }

  const moveZh = joinNames(moves, moveNames, 'move_id');
  const abilityZh = joinNames(abilities, abilityNames, 'ability_id');
  const itemZh = joinNames(items, itemNames, 'item_id');

  const data = { species, moves: moveZh, abilities: abilityZh, items: itemZh };
  const outDir = join(__dirname, '..', 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'zh.json'), JSON.stringify(data));
  console.log(`Wrote zh.json: species=${Object.keys(species).length} moves=${Object.keys(moveZh).length} abilities=${Object.keys(abilityZh).length} items=${Object.keys(itemZh).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });