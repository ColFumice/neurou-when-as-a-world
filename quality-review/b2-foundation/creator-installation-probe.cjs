// Read-only inspection of installed Creator's ASAR manifest/API implementation.
const fs = require('fs');
const archive = 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar';
const descriptor = fs.openSync(archive, 'r');
const prefix = Buffer.alloc(16);
fs.readSync(descriptor, prefix, 0, 16, 0);
const headerLength = prefix.readUInt32LE(4);
const jsonLength = prefix.readUInt32LE(12);
const headerBytes = Buffer.alloc(jsonLength);
fs.readSync(descriptor, headerBytes, 0, jsonLength, 16);
const header = JSON.parse(headerBytes.toString());
const entries = [];
function visit(directory, parent = '') {
  for (const [name, entry] of Object.entries(directory.files || {})) {
    const filename = parent ? parent + '/' + name : name;
    if (entry.files) { visit(entry, filename); }
    else { entries.push({ filename, ...entry }); }
  }
}
visit(header);
const select = process.argv[2] || 'api';
if (select === 'read') {
  const entry = entries.find(entry => entry.filename === process.argv[3]);
  if (!entry || entry.unpacked || !entry.offset) { throw new Error('Packed file missing'); }
  const bytes = Buffer.alloc(entry.size);
  fs.readSync(descriptor, bytes, 0, bytes.length, 8 + headerLength + Number(entry.offset));
  console.log(bytes.toString('utf8'));
  fs.closeSync(descriptor);
  process.exit(0);
}
if (select === 'list') {
  console.log(JSON.stringify(entries.filter(entry => /builtin\/(?:asset-db|preview)|core\/server|server.*http|http.*server/.test(entry.filename)).map(entry => ({ filename: entry.filename, size: entry.size, unpacked: entry.unpacked })), null, 2));
  fs.closeSync(descriptor);
  process.exit(0);
}
for (const entry of entries.filter(entry => /\.js$/.test(entry.filename) &&
  (select === 'api' ? /asset-db|preview|server|http/i.test(entry.filename) : entry.filename.includes(select)))) {
  if (entry.unpacked || !entry.offset || entry.size > 3e6) { continue; }
  const bytes = Buffer.alloc(entry.size);
  fs.readSync(descriptor, bytes, 0, bytes.length, 8 + headerLength + Number(entry.offset));
  const content = bytes.toString('utf8');
  const pattern = /refresh-asset|refreshAsset|refresh.*asset-db|asset-db.*refresh|router\.(?:get|post)|app\.(?:get|post)|\brefresh\b/g;
  let match;
  const snippets = [];
  while ((match = pattern.exec(content)) && snippets.length < 12) {
    snippets.push(content.slice(Math.max(0, match.index - 200), Math.min(content.length, match.index + 350)));
  }
  if (snippets.length) { console.log(JSON.stringify({ filename: entry.filename, snippets })); }
}
fs.closeSync(descriptor);
