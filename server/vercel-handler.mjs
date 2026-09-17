import { answerChat } from './chat-service.mjs';
import { ApiError, errorResponse } from './errors.mjs';
import { GROQ_MODEL } from './groq-client.mjs';
import { generateMealPlan } from './meal-plan-service.mjs';
import { chatRequestSchema, mealPlanRequestSchema } from './schemas.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const requests = new Map();

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

function requestHost(headers) {
  const forwardedHost = headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost) return forwardedHost.split(',')[0].trim();
  return headers.host;
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
  if (originHost !== requestHost(req.headers)) {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Origem da requisição não permitida.');
  }
}

function readBody(req) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
    throw new ApiError(415, 'INVALID_REQUEST', 'Envie JSON com Content-Type application/json.');
  }
  const claimedLength = Number(req.headers['content-length']);
  if (Number.isFinite(claimedLength) && claimedLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'INVALID_REQUEST', 'Requisição grande demais.');
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'JSON inválido.');
  }
  if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_BODY_BYTES) {
    throw new ApiError(413, 'INVALID_REQUEST', 'Requisição grande demais.');
  }
  return req.body;
}

function limitRequests(req) {
  const now = Date.now();
  const forwardedFor = req.headers['x-forwarded-for'];
  const address = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
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
}

export function createVercelHandler(kind, {
  token = process.env.GROQ_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!['meal-plan', 'chat', 'health'].includes(kind)) {
    throw new TypeError('Tipo de endpoint inválido.');
  }
  const schema = kind === 'meal-plan' ? mealPlanRequestSchema : chatRequestSchema;

  return async function handler(req, res) {
    try {
      if (kind === 'health') {
        if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
        sendJSON(res, 200, { status: 'ok', aiConfigured: Boolean(token?.trim()) });
        return;
      }
      if (req.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
      validateSameOrigin(req);
      limitRequests(req);

      const parsed = schema.safeParse(readBody(req));
      if (!parsed.success) throw new ApiError(400, 'INVALID_REQUEST', 'Dados inválidos. Revise os campos e tente novamente.');

      const options = { token, fetchImpl };
      const data = kind === 'meal-plan'
        ? await generateMealPlan(parsed.data.profile, options)
        : {
          success: true,
          answer: await answerChat(parsed.data, options),
          provider: 'groq',
          model: GROQ_MODEL,
        };
      sendJSON(res, 200, data);
    } catch (error) {
      // Não registre prompt, resposta do provedor, token ou dados pessoais em logs.
      const { status, body } = errorResponse(error);
      sendJSON(res, status, body);
    }
  };
}
