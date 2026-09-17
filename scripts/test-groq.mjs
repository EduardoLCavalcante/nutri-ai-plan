import { callGroq } from '../server/groq-client.mjs';

if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY não configurada no servidor.');
  process.exitCode = 1;
} else {
  try {
    const answer = await callGroq({
      messages: [
        { role: 'system', content: 'Responda em português, brevemente.' },
        { role: 'user', content: 'Diga uma saudação curta.' },
      ],
      maxTokens: 256,
      temperature: 0,
    });
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new Error('Resposta vazia da IA.');
    }
    console.log('Groq respondeu com conteúdo válido.');
  } catch (error) {
    console.error(`Smoke test da Groq falhou: ${error?.code || 'UNKNOWN_ERROR'}.`);
    process.exitCode = 1;
  }
}
