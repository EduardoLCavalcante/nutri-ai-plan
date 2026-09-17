import { ApiError } from './errors.mjs';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'openai/gpt-oss-20b';

const timeoutError = () => new ApiError(504, 'GROQ_TIMEOUT', 'A IA demorou para responder. Tente novamente.');

async function withTimeout(operation, signal, timeoutMs) {
  if (signal?.aborted) throw timeoutError();
  const controller = new AbortController();
  let timer;
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(timeoutError());
    };
    timer = setTimeout(onAbort, timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
  try {
    const task = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw timeoutError();
      return operation(controller.signal);
    });
    return await Promise.race([task, interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function providerError(status) {
  if (status === 401 || status === 403) {
    return new ApiError(502, 'GROQ_AUTH_ERROR', 'A autenticação do serviço de IA falhou.');
  }
  if (status === 429) {
    return new ApiError(429, 'GROQ_RATE_LIMIT', 'Limite temporário da IA atingido.');
  }
  if (status === 402 || status >= 500) {
    return new ApiError(503, 'GROQ_UNAVAILABLE', 'O serviço de IA está temporariamente indisponível.');
  }
  return new ApiError(502, 'GROQ_UNAVAILABLE', 'A chamada ao serviço de IA falhou.');
}

/**
 * Call Groq and return the trimmed text of the first completion.
 * Inject token/fetchImpl for tests; callers can also provide an abort signal.
 */
export async function callGroq({
  messages,
  maxTokens = 1200,
  temperature = 0.5,
  signal,
  token = process.env.GROQ_API_KEY,
  fetchImpl = globalThis.fetch,
  responseFormat,
  timeoutMs = 30_000,
}) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', 'A IA não está configurada no servidor.');
  }

  try {
    return await withTimeout(async (requestSignal) => {
      const response = await fetchImpl(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature,
          max_completion_tokens: maxTokens,
          reasoning_effort: 'low',
          include_reasoning: false,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: requestSignal,
      });

      if (!response.ok) {
        if (responseFormat && (response.status === 400 || response.status === 422)) {
          // Only inspect the provider error code. Its message can contain private data.
          const providerBody = await response.json().catch(() => null);
          if (providerBody?.error?.code === 'json_validate_failed') {
            throw new ApiError(502, 'INVALID_AI_RESPONSE', 'A IA não conseguiu gerar um plano válido. Tente novamente.');
          }
        }
        throw providerError(response.status);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new ApiError(502, 'INVALID_AI_RESPONSE', 'A IA retornou uma resposta inválida.');
      }
      if (data?.choices?.[0]?.finish_reason === 'length') {
        throw new ApiError(502, 'INVALID_AI_RESPONSE', 'A IA interrompeu a resposta antes de concluir. Tente novamente.');
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new ApiError(502, 'INVALID_AI_RESPONSE', 'A IA retornou uma resposta vazia ou inválida.');
      }
      return content.trim();
    }, signal, timeoutMs);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || signal?.aborted) {
      throw timeoutError();
    }
    throw new ApiError(502, 'GROQ_UNAVAILABLE', 'Não foi possível conectar ao serviço de IA. Tente novamente.');
  }
}
