const archiver = require('archiver');
const fs = require('fs');

// check for args
const browser = process.argv[2];
// config
const srcDir = 'loc-bulk-access/';
const destDir = 'builds/';
const manifest = require('./loc-bulk-access/manifest.json');

const { version } = manifest;
const destFile = `${destDir}loc-bulk-access-${browser}-${version}.zip`;

function zipDirectory(sourceDir, outPath) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on('error', (err) => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

zipDirectory(srcDir, destFile);
