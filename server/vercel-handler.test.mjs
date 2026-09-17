import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVercelHandler } from './vercel-handler.mjs';

let requestNumber = 0;
const chatPayload = {
  question: 'Qual fonte vegetal de proteína posso usar?',
  context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
  history: [],
};

async function invoke(handler, {
  method = 'POST',
  body,
  headers = {},
} = {}) {
  requestNumber += 1;
  const responseHeaders = new Map();
  let responseBody = '';
  const req = {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      host: 'nutri.example',
      'x-forwarded-for': `198.51.100.${requestNumber}`,
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = {
    statusCode: 200,
    setHeader(name, value) { responseHeaders.set(name.toLowerCase(), value); },
    end(value) { responseBody = value; },
  };
  await handler(req, res);
  return {
    status: res.statusCode,
    headers: responseHeaders,
    body: JSON.parse(responseBody),
  };
}

test('função Vercel responde ao chat no mesmo domínio', async () => {
  let providerRequest;
  const handler = createVercelHandler('chat', {
    token: 'groq_test',
    fetchImpl: async (_url, request) => {
      providerRequest = JSON.parse(request.body);
      return Response.json({ choices: [{ message: { content: 'Inclua feijão ou lentilha na refeição.' } }] });
    },
  });
  const response = await invoke(handler, {
    headers: { origin: 'https://nutri.example', 'sec-fetch-site': 'same-origin' },
    body: chatPayload,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.provider, 'groq');
  assert.equal(response.body.model, 'openai/gpt-oss-20b');
  assert.match(response.body.answer, /procure um nutricionista\.$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(providerRequest.model, 'openai/gpt-oss-20b');
});

test('função Vercel usa o host público encaminhado e bloqueia outra origem', async () => {
  const handler = createVercelHandler('chat', { token: 'groq_test' });
  const accepted = await invoke(handler, {
    headers: {
      host: 'internal.vercel',
      'x-forwarded-host': 'nutri.example',
      origin: 'https://nutri.example',
    },
    body: {
      question: '',
      context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
      history: [],
    },
  });
  assert.equal(accepted.status, 400);
  assert.equal(accepted.body.code, 'INVALID_REQUEST');

  const rejected = await invoke(handler, {
    headers: { origin: 'https://outro.example' },
    body: {
      question: '',
      context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
      history: [],
    },
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.code, 'INVALID_ORIGIN');
  assert.match(rejected.body.error, /Origem/);
});

test('função Vercel de health informa chave configurada sem acessar a Groq', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Groq não deve ser chamada'); };
  for (const [token, aiConfigured] of [['groq_health_secret', true], ['', false]]) {
    const handler = createVercelHandler('health', { token, fetchImpl });
    const response = await invoke(handler, { method: 'GET' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', aiConfigured });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('rota api/health.mjs exporta o handler GET usado pela Vercel', async () => {
  const { default: handler } = await import('../api/health.mjs');
  const response = await invoke(handler, { method: 'GET' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    aiConfigured: Boolean(process.env.GROQ_API_KEY),
  });
});

for (const scenario of [
  { status: 429, code: 'GROQ_RATE_LIMIT', mock: () => new Response('provider private rate', { status: 429 }) },
  { status: 502, code: 'GROQ_AUTH_ERROR', mock: () => new Response('provider private auth', { status: 401 }) },
  { status: 503, code: 'GROQ_UNAVAILABLE', mock: () => new Response('provider private outage', { status: 503 }) },
  { status: 504, code: 'GROQ_TIMEOUT', mock: () => { throw Object.assign(new Error('provider private timeout'), { name: 'TimeoutError' }); } },
]) {
  test(`função Vercel de chat devolve erro ${scenario.status} padronizado e seguro`, async () => {
    const handler = createVercelHandler('chat', { token: 'groq_vercel_secret', fetchImpl: scenario.mock });
    const response = await invoke(handler, { body: chatPayload });
    assert.equal(response.status, scenario.status);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, scenario.code);
    assert.equal(typeof response.body.error, 'string');
    assert.equal(response.body.answer, undefined);
    assert.equal(JSON.stringify(response.body).includes('groq_vercel_secret'), false);
    assert.equal(JSON.stringify(response.body).includes('provider private'), false);
    assert.equal(JSON.stringify(response.body).includes(chatPayload.question), false);
  });
}
