const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg'
};

http.createServer((req, res) => {
  // API: convert uploaded image (base64 JSON) to a short H.264 MP4 using ffmpeg
  if (req.method === 'POST' && req.url === '/api/convert') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // simple protection against huge uploads
      if (body.length > 20 * 1024 * 1024) { // ~20MB
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('Payload too large');
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed || !parsed.data || !parsed.filename) throw new Error('Missing data');

        const match = parsed.data.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new Error('Invalid data URI');

        const b64 = match[2];
        const buffer = Buffer.from(b64, 'base64');

        const outputsDir = path.join(__dirname, 'outputs');
        if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

        const inputName = `${Date.now()}-${path.basename(parsed.filename)}`;
        const inputPath = path.join(outputsDir, inputName);
        fs.writeFileSync(inputPath, buffer);

        const outName = `${Date.now()}-converted.mp4`;
        const outPath = path.join(outputsDir, outName);

        // ffmpeg command to create a 3s H.264 MP4 with a tiny fade in/out
        const spawn = require('child_process').spawn;
        const args = [
          '-y',
          '-loop', '1',
          '-i', inputPath,
          '-t', '3',
          '-vf', "fade=t=in:st=0:d=0.3,fade=t=out:st=2.7:d=0.3,scale=trunc(iw/2)*2:trunc(ih/2)*2",
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          outPath
        ];

        const ff = spawn('ffmpeg', args);
        let fferr = '';
        ff.stderr.on('data', d => fferr += d.toString());

        ff.on('close', code => {
          if (code === 0) {
            // remove input to save space
            try { fs.unlinkSync(inputPath); } catch (e) {}
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: `/outputs/${outName}` }));
          } else {
            console.error('ffmpeg failed:', fferr);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Conversion failed');
          }
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request: ' + (err && err.message ? err.message : 'invalid'));
      }
    });

    return;
  }

  // static file serving for other requests
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('404 - File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Support Range requests for media (required for Firefox/seek/stream)
    const range = req.headers.range;
    if (range) {
      const positions = range.replace(/bytes=/, '').split('-');
      const start = parseInt(positions[0], 10);
      const total = stats.size;
      const end = positions[1] ? parseInt(positions[1], 10) : total - 1;

      if (start >= total || end >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}).listen(PORT, () => {
  console.log(`Server running at:`);
  console.log(`👉 http://localhost:${PORT}`);
});
