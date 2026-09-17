import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApiError,
  answerChat,
  chatRequestSchema,
  generateMealPlan,
  mealPlanRequestSchema,
} from './nutrition.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultStaticDir = path.join(root, 'dist');
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
      reject(new ApiError(415, 'Envie JSON com Content-Type application/json.'));
      req.resume();
      return;
    }
    const claimedLength = Number(req.headers['content-length']);
    if (Number.isFinite(claimedLength) && claimedLength > MAX_BODY_BYTES) {
      reject(new ApiError(413, 'Requisição grande demais.'));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let complete = false;
    req.on('data', (chunk) => {
      if (complete) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        complete = true;
        reject(new ApiError(413, 'Requisição grande demais.'));
        req.resume();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (complete) return;
      complete = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(400, 'JSON inválido.'));
      }
    });
    req.on('error', () => {
      if (!complete) reject(new ApiError(400, 'Não foi possível ler a requisição.'));
    });
  });
}

function validateSameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new ApiError(403, 'Origem da requisição não permitida.');
  }
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'Origem da requisição não permitida.');
  }
  if (originHost !== req.headers.host) {
    throw new ApiError(403, 'Origem da requisição não permitida.');
  }
}

async function serveStatic(req, res, pathname, staticDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJSON(res, 405, { error: 'Método não permitido.' });
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendJSON(res, 400, { error: 'Caminho inválido.' });
    return;
  }
  if (decoded.includes('\\') || decoded.split('/').some((segment) => segment.startsWith('.'))) {
    sendJSON(res, 404, { error: 'Não encontrado.' });
    return;
  }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(staticDir, relative);
  if (resolved !== staticDir && !resolved.startsWith(`${staticDir}${path.sep}`)) {
    sendJSON(res, 404, { error: 'Não encontrado.' });
    return;
  }
  let file = resolved;
  try {
    if (!(await stat(file)).isFile()) throw new Error('not file');
  } catch {
    if (path.extname(relative) || !req.headers.accept?.includes('text/html')) {
      sendJSON(res, 404, { error: 'Não encontrado.' });
      return;
    }
    file = path.join(staticDir, 'index.html');
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    sendJSON(res, 404, { error: 'Site não compilado. Execute npm run build.' });
  }
}

export function createAppServer({ token = process.env.GROQ_API_KEY, fetchImpl = globalThis.fetch, staticDir = defaultStaticDir } = {}) {
  const requests = new Map();
  const resolvedStaticDir = path.resolve(staticDir);
  const server = createServer(async (req, res) => {
    try {
      let pathname;
      try {
        pathname = new URL(req.url || '/', 'http://localhost').pathname;
      } catch {
        throw new ApiError(400, 'Caminho inválido.');
      }

      if (!pathname.startsWith('/api/')) {
        await serveStatic(req, res, pathname, resolvedStaticDir);
        return;
      }
      if (req.method !== 'POST' || !['/api/meal-plan', '/api/chat'].includes(pathname)) {
        throw new ApiError(404, 'Endpoint não encontrado.');
      }
      validateSameOrigin(req);

      const now = Date.now();
      const address = req.socket.remoteAddress || 'unknown';
      const entry = requests.get(address);
      const current = !entry || now - entry.started >= WINDOW_MS
        ? { started: now, count: 1 }
        : { started: entry.started, count: entry.count + 1 };
      requests.set(address, current);
      if (requests.size > 1000) {
        for (const [key, value] of requests) {
          if (now - value.started >= WINDOW_MS) requests.delete(key);
        }
        while (requests.size > 1000) requests.delete(requests.keys().next().value);
      }
      if (current.count > MAX_REQUESTS) {
        throw new ApiError(429, 'Muitas requisições. Aguarde um minuto e tente novamente.');
      }

      const body = await readJSON(req);
      const schema = pathname === '/api/meal-plan' ? mealPlanRequestSchema : chatRequestSchema;
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, 'Dados inválidos. Revise os campos e tente novamente.');

      const options = { token, fetchImpl, signal: AbortSignal.timeout(30_000) };
      if (pathname === '/api/meal-plan') {
        sendJSON(res, 200, await generateMealPlan(parsed.data.profile, options));
      } else {
        sendJSON(res, 200, { answer: await answerChat(parsed.data, options) });
      }
    } catch (error) {
      if (res.headersSent) return;
      // Não registre prompt, resposta do provedor, token ou dados pessoais em logs.
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof ApiError ? error.message : 'Erro interno. Tente novamente.';
      sendJSON(res, status, { error: message });
    }
  });
  server.requestTimeout = 35_000;
  return server;
}
