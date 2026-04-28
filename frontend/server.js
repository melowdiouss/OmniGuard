const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const API_TARGET = (process.env.API_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
}

function proxyRequest(request, response) {
  const targetUrl = new URL(request.url, API_TARGET);
  const proxy = http.request(
    targetUrl,
    {
      method: request.method,
      headers: {
        ...request.headers,
        host: targetUrl.host,
      },
    },
    (proxyResponse) => {
      const headers = { ...proxyResponse.headers };
      response.writeHead(proxyResponse.statusCode || 500, headers);
      proxyResponse.pipe(response);
    },
  );

  proxy.on('error', (error) => {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: { message: error.message, code: 'PROXY_ERROR' } }));
  });

  request.pipe(proxy);
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/') || request.url === '/health') {
    proxyRequest(request, response);
    return;
  }

  const normalizedUrl = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.join(ROOT_DIR, normalizedUrl.split('?')[0]);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(response, filePath);
    return;
  }

  sendFile(response, path.join(ROOT_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`OmniGuard frontend available at http://localhost:${PORT}`);
  console.log(`Proxying API requests to ${API_TARGET}`);
});