import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerChat } from './chat-service.mjs';

const request = {
  question: 'Posso trocar o jantar?',
  context: { objetivo: 'manutencao', perfil: 'nao_atleta', restricoes: '' },
  history: [
    { role: 'user', content: 'Prefiro lentilha.' },
    { role: 'assistant', content: 'Lentilha é uma opção.' },
  ],
  mealPlan: {
    calorias_diarias: 2000,
    macros: { proteinas: '100g', carboidratos: '250g', gorduras: '65g' },
    refeicoes: [{ nome: 'Jantar', alimentos: [{ nome: 'Arroz', quantidade: '100 g', calorias: 130 }] }],
  },
};

test('chat-service monta contexto e histórico e processa a resposta da Groq', async () => {
  let providerRequest;
  const answer = await answerChat(request, {
    token: 'groq_unit_secret',
    fetchImpl: async (_url, init) => {
      providerRequest = JSON.parse(init.body);
      return Response.json({ choices: [{ message: { content: 'Troque por uma porção equivalente de lentilha.' } }] });
    },
  });

  assert.match(answer, /^Troque por uma porção equivalente de lentilha\./);
  assert.match(answer, /procure um nutricionista\.$/);
  assert.equal(providerRequest.model, 'openai/gpt-oss-20b');
  assert.equal(providerRequest.max_completion_tokens, 1200);
  assert.equal(providerRequest.reasoning_effort, 'low');
  assert.equal(providerRequest.include_reasoning, false);
  assert.equal(providerRequest.messages.at(-1).content, request.question);
  assert.deepEqual(providerRequest.messages.slice(-3, -1), request.history);
  assert.match(providerRequest.messages[1].content, /Jantar/);
  assert.equal(JSON.stringify(providerRequest).includes('groq_unit_secret'), false);
});

for (const scenario of [
  {
    name: 'resposta vazia',
    response: () => Response.json({ choices: [{ message: { content: '  ' } }] }),
    status: 502,
    code: 'INVALID_AI_RESPONSE',
  },
  {
    name: 'timeout',
    response: () => { throw Object.assign(new Error('private timeout detail'), { name: 'TimeoutError' }); },
    status: 504,
    code: 'GROQ_TIMEOUT',
  },
  {
    name: 'rate limit',
    response: () => new Response('private rate detail', { status: 429 }),
    status: 429,
    code: 'GROQ_RATE_LIMIT',
  },
  {
    name: 'autenticação',
    response: () => new Response('private auth detail', { status: 401 }),
    status: 502,
    code: 'GROQ_AUTH_ERROR',
  },
]) {
  test(`chat-service classifica ${scenario.name} sem vazar dados do provedor`, async () => {
    await assert.rejects(
      answerChat(request, { token: 'groq_unit_secret', fetchImpl: scenario.response }),
      (error) => {
        assert.equal(error.status, scenario.status);
        assert.equal(error.code, scenario.code);
        assert.equal(String(error.message).includes('private'), false);
        assert.equal(String(error.message).includes('groq_unit_secret'), false);
        return true;
      },
    );
  });
}
