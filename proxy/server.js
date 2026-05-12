const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Config Jira (peut être surchargée par variables d'env ou par le header X-Jira-Url)
const DEFAULT_JIRA_URL = process.env.JIRA_URL || '';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN === '*' ? (origin || '*') : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jira-Url, X-Atlassian-Token, X-Title, Referer, Origin, http-referer, x-title',
    'Access-Control-Max-Age': '86400'
  };
}

function forwardRequest(req, res, targetUrl, headers, body) {
  const parsed = url.parse(targetUrl);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.path,
    method: req.method,
    headers: {
      ...headers,
      'host': parsed.hostname,
      'content-length': body ? Buffer.byteLength(body) : 0
    },
    rejectUnauthorized: false // pour les certs auto-signés internes
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    const responseHeaders = {
      ...corsHeaders(req.headers.origin),
      'content-type': proxyRes.headers['content-type'] || 'application/json'
    };
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
    log(`${req.method} ${targetUrl} → ${proxyRes.statusCode}`);
  });

  proxyReq.on('error', (err) => {
    log(`Erreur proxy: ${err.message}`);
    res.writeHead(502, corsHeaders(req.headers.origin));
    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ status: 'ok', jira: DEFAULT_JIRA_URL || 'non configuré' }));
    return;
  }

  // Proxy Jira : /jira-proxy/rest/api/2/...
  if (pathname.startsWith('/jira-proxy/')) {
    const jiraBase = req.headers['x-jira-url'] || DEFAULT_JIRA_URL;
    if (!jiraBase) {
      res.writeHead(400, corsHeaders(origin));
      res.end(JSON.stringify({ error: 'URL Jira non configurée. Fournissez le header X-Jira-Url ou configurez JIRA_URL.' }));
      return;
    }
    const jiraPath = pathname.replace('/jira-proxy', '');
    const targetUrl = jiraBase.replace(/\/$/, '') + jiraPath + (parsedUrl.search || '');
    const forwardHeaders = {};
    if (req.headers.authorization) forwardHeaders.authorization = req.headers.authorization;
    forwardHeaders['content-type'] = req.headers['content-type'] || 'application/json';
    forwardHeaders['x-atlassian-token'] = 'no-check';

    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => forwardRequest(req, res, targetUrl, forwardHeaders, chunks.length ? Buffer.concat(chunks) : null));
    return;
  }

  // Proxy OpenRouter : /ai-proxy/...
  if (pathname.startsWith('/ai-proxy/')) {
    const aiPath = pathname.replace('/ai-proxy', '');
    const targetUrl = 'https://openrouter.ai/api/v1' + aiPath + (parsedUrl.search || '');
    const forwardHeaders = {};
    if (req.headers.authorization) forwardHeaders.authorization = req.headers.authorization;
    if (req.headers['http-referer']) forwardHeaders['http-referer'] = req.headers['http-referer'];
    if (req.headers['x-title']) forwardHeaders['x-title'] = req.headers['x-title'];
    forwardHeaders['content-type'] = req.headers['content-type'] || 'application/json';

    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => forwardRequest(req, res, targetUrl, forwardHeaders, chunks.length ? Buffer.concat(chunks) : null));
    return;
  }

  res.writeHead(404, corsHeaders(origin));
  res.end(JSON.stringify({ error: 'Route non trouvée', routes: ['/health', '/jira-proxy/...', '/ai-proxy/...'] }));
});

server.listen(PORT, () => log(`Proxy démarré sur le port ${PORT}`));
