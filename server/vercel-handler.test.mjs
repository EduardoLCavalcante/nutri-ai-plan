import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVercelHandler } from './vercel-handler.mjs';

let requestNumber = 0;

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
    body: {
      question: 'Qual fonte vegetal de proteína posso usar?',
      context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
      history: [],
    },
  });

  assert.equal(response.status, 200);
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

  const rejected = await invoke(handler, {
    headers: { origin: 'https://outro.example' },
    body: {
      question: '',
      context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
      history: [],
    },
  });
  assert.equal(rejected.status, 403);
  assert.match(rejected.body.error, /Origem/);
});
