const fs = require('fs');

// check for args
let browser = 'chrome';
if (process.argv.length > 2) browser = process.argv[2];

// build and create globals.js
const browserAPI = browser === 'chrome' ? 'chrome' : 'browser';
let globalsContent = `const browserAPI = ${browserAPI};\n`;
globalsContent += 'export default browserAPI;\n';
fs.writeFileSync('loc-bulk-access/ui/js/globals.js', globalsContent);

// copy the manifest.json
const srcManifest = `manifest-${browser}.json`;
const destManifest = 'loc-bulk-access/manifest.json';
fs.copyFileSync(srcManifest, destManifest);
