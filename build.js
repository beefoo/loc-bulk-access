const archiver = require('archiver');
const fs = require('fs');

// check for args
let browser = 'chrome';
if (process.argv.length > 2) browser = process.argv[2];

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

const tString = new Date().toISOString().split('T')[0];
zipDirectory('loc-bulk-access/', `builds/loc-bulk-access-${browser}-${tString}.zip`);
