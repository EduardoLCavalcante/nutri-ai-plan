import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAppServer } from './app.mjs';

const profile = {
  idade: 30,
  sexo: 'masculino',
  altura: 170,
  peso: 70,
  perfil: 'nao_atleta',
  objetivo: 'manutencao',
  tempo: 30,
  refeicoes: 4,
  restricoes: '',
  preferencias: '',
  alimentosNaoGosta: '',
};
const plan = {
  calorias_diarias: 2600,
  macros: { proteinas: '130g', carboidratos: '310g', gorduras: '80g' },
  refeicoes: [600, 650, 700, 650].map((calorias, index) => ({
    nome: `Refeição ${index + 1}`,
    alimentos: [{ nome: `Alimento ${index + 1}`, quantidade: '1 porção', calorias }],
  })),
  aviso: 'texto gerado',
};
const providerPlan = {
  ...plan,
  refeicoes: Object.fromEntries(plan.refeicoes.map((meal, index) => [`refeicao_${index + 1}`, meal])),
};
const chatPayload = {
  question: 'E no jantar?',
  context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
  history: [],
};

async function withServer(t, options = {}) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(url, pathname, body, headers = {}) {
  return fetch(`${url}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('gera plano validado, calcula energia e não envia nome nem chave ao cliente', async (t) => {
  let providerRequest;
  let providerUrl;
  const url = await withServer(t, {
    token: 'groq_test_secret',
    fetchImpl: async (requestUrl, request) => {
      providerUrl = requestUrl;
      providerRequest = request;
      return Response.json({ choices: [{ message: { content: JSON.stringify(providerPlan) } }] });
    },
  });
  const response = await post(url, '/api/meal-plan', { profile: { ...profile, nome: 'Maria' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.refeicoes.length, 4);
  assert.equal(body.calorias_diarias, 2600);
  assert.ok(body.tmb > 0 && body.get > body.tmb);
  assert.match(body.aviso, /não substitui/);
  assert.equal(JSON.stringify(body).includes('groq_test_secret'), false);
  assert.equal(providerUrl, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(providerRequest.headers.Authorization, 'Bearer groq_test_secret');
  assert.equal(providerRequest.body.includes('Maria'), false);
  const sent = JSON.parse(providerRequest.body);
  assert.equal(sent.model, 'openai/gpt-oss-20b');
  assert.equal(sent.max_completion_tokens, 4000);
  assert.equal(sent.max_tokens, undefined);
  assert.equal(sent.response_format.type, 'json_schema');
  assert.equal(sent.response_format.json_schema.name, 'meal_plan');
  assert.equal(sent.response_format.json_schema.strict, true);
  const schema = sent.response_format.json_schema.schema;
  assert.deepEqual(schema.required, ['calorias_diarias', 'macros', 'refeicoes', 'aviso']);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.macros.additionalProperties, false);
  assert.deepEqual(schema.properties.macros.required, ['proteinas', 'carboidratos', 'gorduras']);
  assert.equal(schema.properties.macros.properties.proteinas.type, 'string');
  assert.equal(schema.properties.macros.properties.carboidratos.type, 'string');
  assert.equal(schema.properties.macros.properties.gorduras.type, 'string');
  const mealCollection = schema.properties.refeicoes;
  assert.equal(mealCollection.type, 'object');
  assert.equal(mealCollection.additionalProperties, false);
  assert.deepEqual(mealCollection.required, ['refeicao_1', 'refeicao_2', 'refeicao_3', 'refeicao_4']);
  const mealSchema = mealCollection.properties.refeicao_1;
  assert.deepEqual(mealSchema.required, ['nome', 'alimentos']);
  assert.equal(mealSchema.additionalProperties, false);
  const foodSchema = mealSchema.properties.alimentos.items;
  assert.deepEqual(foodSchema.required, ['nome', 'quantidade', 'calorias']);
  assert.equal(foodSchema.additionalProperties, false);
  assert.equal(foodSchema.properties.quantidade.type, 'string');
  assert.equal(foodSchema.properties.calorias.type, 'number');
  assert.equal(sent.reasoning_effort, 'low');
  assert.equal(sent.include_reasoning, false);
  assert.ok(Array.isArray(sent.messages));
});

test('rejeita perfil inválido antes de chamar o provedor', async (t) => {
  let calls = 0;
  const url = await withServer(t, { token: 'groq_test', fetchImpl: async () => { calls++; } });
  const response = await post(url, '/api/meal-plan', { profile: { ...profile, idade: -1 } });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('rejeita plano quebrado e calorias incoerentes sem repassar dados do provedor', async (t) => {
  const url = await withServer(t, {
    token: 'groq_test',
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...plan, refeicoes: {} }) } }] }),
  });
  const response = await post(url, '/api/meal-plan', { profile });
  assert.equal(response.status, 502);
  assert.equal(JSON.stringify(await response.json()).includes('refeicoes'), false);

  const url2 = await withServer(t, {
    token: 'groq_test',
    fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      ...providerPlan,
      refeicoes: Object.fromEntries(Object.entries(providerPlan.refeicoes).map(([name, meal]) => [
        name,
        { ...meal, alimentos: [{ ...meal.alimentos[0], calorias: 100 }] },
      ])),
    }) } }] }),
  });
  assert.equal((await post(url2, '/api/meal-plan', { profile })).status, 502);
});

test('rejeita macros e quantidades numéricas mesmo se o provedor ignorar o schema', async (t) => {
  for (const invalidPlan of [
    { ...providerPlan, macros: { proteinas: 130, carboidratos: 310, gorduras: 80 } },
    {
      ...providerPlan,
      refeicoes: Object.fromEntries(Object.entries(providerPlan.refeicoes).map(([name, meal]) => [
        name,
        { ...meal, alimentos: meal.alimentos.map((food) => ({ ...food, quantidade: 100 })) },
      ])),
    },
  ]) {
    const url = await withServer(t, {
      token: 'groq_test',
      fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify(invalidPlan) } }] }),
    });
    const response = await post(url, '/api/meal-plan', { profile });
    assert.equal(response.status, 502);
    assert.equal(JSON.stringify(await response.json()).includes('130'), false);
  }
});

test('refaz uma vez o plano após resposta incompleta ou falha de JSON da Groq', async (t) => {
  const failures = [
    () => Response.json({ choices: [{ message: { content: JSON.stringify({
      ...providerPlan,
      refeicoes: { refeicao_1: providerPlan.refeicoes.refeicao_1 },
    }) } }] }),
    () => Response.json({ error: { code: 'json_validate_failed', message: 'detalhes sensíveis' } }, { status: 400 }),
  ];
  for (const fail of failures) {
    const requests = [];
    const url = await withServer(t, {
      token: 'groq_test',
      fetchImpl: async (_url, request) => {
        requests.push(JSON.parse(request.body));
        return requests.length === 1
          ? fail()
          : Response.json({ choices: [{ message: { content: JSON.stringify(providerPlan) } }] });
      },
    });
    const response = await post(url, '/api/meal-plan', { profile });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).refeicoes.length, 4);
    assert.equal(requests.length, 2);
    assert.match(requests[1].messages.at(-1).content, /Refaça o plano inteiro/);
    assert.equal(requests[1].response_format.json_schema.strict, true);
  }
});

test('chat envia contexto e histórico e devolve resposta segura', async (t) => {
  let sent;
  const url = await withServer(t, {
    token: 'groq_test',
    fetchImpl: async (_url, request) => {
      sent = JSON.parse(request.body);
      return Response.json({ choices: [{ message: { content: 'Pode substituir por outra fonte de proteína.' } }] });
    },
  });
  const response = await post(url, '/api/chat', {
    question: 'E no jantar?',
    context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
    history: [{ role: 'user', content: 'Posso trocar frango?' }, { role: 'assistant', content: 'Sim.' }],
    mealPlan: { ...plan, aviso: 'Educativo', tmb: 1600, get: 2500 },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['answer', 'model', 'provider', 'success']);
  assert.equal(body.success, true);
  assert.equal(body.provider, 'groq');
  assert.equal(body.model, 'openai/gpt-oss-20b');
  assert.match(body.answer, /procure um nutricionista\.$/);
  assert.equal(sent.messages.at(-1).content, 'E no jantar?');
  assert.equal(sent.messages.at(-2).content, 'Sim.');
  assert.match(sent.messages[1].content, /Refeição 1/);
  assert.equal(sent.model, 'openai/gpt-oss-20b');
  assert.equal(sent.max_completion_tokens, 1200);
  assert.equal(sent.response_format, undefined);
});

test('GET /api/health informa disponibilidade e configuração sem chamar a Groq', async (t) => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Groq não deve ser chamada'); };
  for (const [token, aiConfigured] of [['groq_health_secret', true], ['', false]]) {
    const url = await withServer(t, { token, fetchImpl });
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', aiConfigured });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('POST /api/chat rejeita payload inválido com JSON padronizado antes da Groq', async (t) => {
  let calls = 0;
  const url = await withServer(t, {
    token: 'groq_api_secret',
    fetchImpl: async () => { calls++; throw new Error('Groq não deve ser chamada'); },
  });
  const response = await post(url, '/api/chat', { ...chatPayload, question: '' });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'INVALID_REQUEST');
  assert.equal(typeof body.error, 'string');
  assert.equal(calls, 0);
});

test('POST /api/chat informa chave ausente sem chamar a Groq', async (t) => {
  let calls = 0;
  const url = await withServer(t, {
    token: '',
    fetchImpl: async () => { calls++; throw new Error('Groq não deve ser chamada'); },
  });
  const response = await post(url, '/api/chat', chatPayload);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'AI_NOT_CONFIGURED');
  assert.equal(calls, 0);
});

for (const scenario of [
  { status: 429, code: 'GROQ_RATE_LIMIT', mock: () => new Response('provider private rate', { status: 429 }) },
  { status: 502, code: 'GROQ_AUTH_ERROR', mock: () => new Response('provider private auth', { status: 401 }) },
  { status: 503, code: 'GROQ_UNAVAILABLE', mock: () => new Response('provider private outage', { status: 503 }) },
  { status: 504, code: 'GROQ_TIMEOUT', mock: () => { throw Object.assign(new Error('provider private timeout'), { name: 'TimeoutError' }); } },
]) {
  test(`POST /api/chat devolve ${scenario.status} e código ${scenario.code} sem dados internos`, async (t) => {
    const url = await withServer(t, { token: 'groq_api_secret', fetchImpl: scenario.mock });
    const response = await post(url, '/api/chat', chatPayload);
    assert.equal(response.status, scenario.status);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.code, scenario.code);
    assert.equal(typeof body.error, 'string');
    assert.equal(body.answer, undefined);
    assert.equal(JSON.stringify(body).includes('groq_api_secret'), false);
    assert.equal(JSON.stringify(body).includes('provider private'), false);
    assert.equal(JSON.stringify(body).includes(chatPayload.question), false);
  });
}

test('bloqueia origem cruzada e requisição excessiva', async (t) => {
  let calls = 0;
  const url = await withServer(t, { token: 'groq_test', fetchImpl: async () => { calls++; } });
  const originResponse = await post(url, '/api/meal-plan', { profile }, { Origin: 'https://example.com' });
  assert.equal(originResponse.status, 403);
  const bigResponse = await post(url, '/api/meal-plan', { profile, padding: 'x'.repeat(66_000) });
  assert.equal(bigResponse.status, 413);
  assert.equal(calls, 0);
});

test('limita requisições repetidas por endereço', async (t) => {
  const url = await withServer(t, { token: 'groq_test' });
  for (let index = 0; index < 20; index++) {
    const response = await post(url, '/api/meal-plan', { profile: { ...profile, idade: -1 } });
    assert.equal(response.status, 400);
  }
  const limited = await post(url, '/api/meal-plan', { profile: { ...profile, idade: -1 } });
  assert.equal(limited.status, 429);
});

test('chave ausente e token recusado produzem erro claro sem expor segredo', async (t) => {
  const url = await withServer(t, { token: '', fetchImpl: async () => { throw new Error('não chamar'); } });
  const missing = await post(url, '/api/meal-plan', { profile });
  assert.equal(missing.status, 503);
  const missingBody = await missing.json();
  assert.equal(missingBody.code, 'AI_NOT_CONFIGURED');
  assert.match(missingBody.error, /não está configurada/);

  const url2 = await withServer(t, { token: 'groq_private_test', fetchImpl: async () => new Response('secret upstream', { status: 401 }) });
  const refused = await post(url2, '/api/meal-plan', { profile });
  assert.equal(refused.status, 502);
  const text = await refused.text();
  assert.equal(JSON.parse(text).code, 'GROQ_AUTH_ERROR');
  assert.equal(text.includes('groq_private_test'), false);
  assert.equal(text.includes('secret upstream'), false);
});

test('limite da Groq e resposta cortada são tratados sem expor corpo do provedor', async (t) => {
  const url = await withServer(t, {
    token: 'groq_private_test',
    fetchImpl: async () => new Response('sensitive rate details', { status: 429 }),
  });
  const limited = await post(url, '/api/chat', {
    question: 'E no jantar?',
    context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
    history: [],
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.text()).includes('sensitive rate details'), false);

  const url2 = await withServer(t, {
    token: 'groq_private_test',
    fetchImpl: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"calorias_diarias":' } }] }),
  });
  const truncated = await post(url2, '/api/meal-plan', { profile });
  assert.equal(truncated.status, 502);
  assert.match((await truncated.json()).error, /interrompeu/);
});
