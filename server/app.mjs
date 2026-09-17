import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerChat } from './chat-service.mjs';
import { ApiError, errorResponse } from './errors.mjs';
import { GROQ_MODEL } from './groq-client.mjs';
import { generateMealPlan } from './meal-plan-service.mjs';
import { chatRequestSchema, mealPlanRequestSchema } from './schemas.mjs';

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
      reject(new ApiError(415, 'INVALID_REQUEST', 'Envie JSON com Content-Type application/json.'));
      req.resume();
      return;
    }
    const claimedLength = Number(req.headers['content-length']);
    if (Number.isFinite(claimedLength) && claimedLength > MAX_BODY_BYTES) {
      reject(new ApiError(413, 'INVALID_REQUEST', 'Requisição grande demais.'));
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
        reject(new ApiError(413, 'INVALID_REQUEST', 'Requisição grande demais.'));
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
        reject(new ApiError(400, 'INVALID_REQUEST', 'JSON inválido.'));
      }
    });
    req.on('error', () => {
      if (!complete) reject(new ApiError(400, 'INVALID_REQUEST', 'Não foi possível ler a requisição.'));
    });
  });
}

function validateSameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Origem da requisição não permitida.');
  }
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Origem da requisição não permitida.');
  }
  if (originHost !== req.headers.host) {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Origem da requisição não permitida.');
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
        throw new ApiError(400, 'INVALID_REQUEST', 'Caminho inválido.');
      }

      if (!pathname.startsWith('/api/')) {
        await serveStatic(req, res, pathname, resolvedStaticDir);
        return;
      }
      if (pathname === '/api/health') {
        if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
        sendJSON(res, 200, { status: 'ok', aiConfigured: Boolean(token?.trim()) });
        return;
      }
      if (!['/api/meal-plan', '/api/chat'].includes(pathname)) {
        throw new ApiError(404, 'NOT_FOUND', 'Endpoint não encontrado.');
      }
      if (req.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
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
        throw new ApiError(429, 'RATE_LIMITED', 'Muitas requisições. Aguarde um minuto e tente novamente.');
      }

      const body = await readJSON(req);
      const schema = pathname === '/api/meal-plan' ? mealPlanRequestSchema : chatRequestSchema;
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new ApiError(400, 'INVALID_REQUEST', 'Dados inválidos. Revise os campos e tente novamente.');

      const options = { token, fetchImpl };
      if (pathname === '/api/meal-plan') {
        sendJSON(res, 200, await generateMealPlan(parsed.data.profile, options));
      } else {
        sendJSON(res, 200, {
          success: true,
          answer: await answerChat(parsed.data, options),
          provider: 'groq',
          model: GROQ_MODEL,
        });
      }
    } catch (error) {
      if (res.headersSent) return;
      // Não registre prompt, resposta do provedor, token ou dados pessoais em logs.
      const { status, body } = errorResponse(error);
      sendJSON(res, status, body);
    }
  });
  server.requestTimeout = 35_000;
  return server;
}
