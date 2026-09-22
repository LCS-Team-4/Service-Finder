// Diagnostic: read the TomTom traffic feed directly, the same way the importer does.
import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('backend/.env', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const key = env.TOMTOM_API_KEY;
const bbox = env.TOMTOM_BBOX ?? '18.35,-34.35,19.00,-33.75';
const url = new URL(env.TOMTOM_URL + '');
url.searchParams.set('key', key);
url.searchParams.set('bbox', bbox);
url.searchParams.set('format', 'json');
url.searchParams.set('language', 'en-GB');
url.searchParams.set('timeValidityFilter', 'present');
url.searchParams.set('fields', '{incidents{type,properties{iconCategory}}}');

const started = Date.now();
const res = await fetch(url);
console.log(`[tomtom] status=${res.status} ${res.statusText} in ${Date.now() - started}ms`);
const text = await res.text();
if (!res.ok) {
  console.log('[tomtom] error body:', text.slice(0, 500));
  process.exit(0);
}
const body = JSON.parse(text);
const incidents = body.incidents ?? [];
const mix = {};
for (const incident of incidents) {
  const code = incident.properties?.iconCategory;
  mix[code] = (mix[code] ?? 0) + 1;
}
console.log(`[tomtom] bbox=${bbox}`);
console.log(`[tomtom] incidents returned = ${incidents.length}`);
console.log(`[tomtom] iconCategory mix = ${JSON.stringify(mix)}`);
