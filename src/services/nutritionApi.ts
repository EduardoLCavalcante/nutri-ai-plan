import { z } from 'zod';
import type { MealPlan, UserData } from '@/contexts/NutritionContext';

type UserProfile = Omit<UserData, 'nome'>;

export interface ChatContext {
  objetivo: string;
  perfil: string;
  restricoes: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const mealPlanSchema = z.object({
  calorias_diarias: z.number().finite().positive(),
  macros: z.object({
    proteinas: z.string().trim().min(1),
    carboidratos: z.string().trim().min(1),
    gorduras: z.string().trim().min(1),
  }),
  refeicoes: z.array(z.object({
    nome: z.string().trim().min(1),
    alimentos: z.array(z.object({
      nome: z.string().trim().min(1),
      quantidade: z.string().trim().min(1),
      calorias: z.number().finite().nonnegative(),
    })).min(1),
  })).min(1),
  aviso: z.string().trim().min(1),
  tmb: z.number().finite().positive(),
  get: z.number().finite().positive(),
});

const parseResponse = async (response: Response): Promise<unknown> => {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data &&
      typeof data.error === 'string' ? data.error : 'Não foi possível se comunicar com a IA.';
    const code = data && typeof data === 'object' && 'code' in data &&
      typeof data.code === 'string' ? data.code : undefined;
    throw new ApiRequestError(message, response.status, code);
  }

  return data;
};

const postJSON = async (path: string, body: unknown): Promise<unknown> => {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiRequestError('A IA demorou para responder. Tente novamente.', 504);
    }
    if (error instanceof TypeError) {
      throw new ApiRequestError('Não foi possível conectar ao servidor. Tente novamente.', null);
    }
    throw error;
  }
};

export const gerarPlanoIA = async (dadosUsuario: UserData): Promise<MealPlan> => {
  // SUA AÇÃO: configure GROQ_API_KEY apenas no servidor (veja .env.example).
  // O nome é usado para exibição na interface e não é enviado ao provedor.
  const { nome: _nome, ...profile } = dadosUsuario;
  const data = await postJSON('/api/meal-plan', { profile: profile satisfies UserProfile });
  const parsed = mealPlanSchema.safeParse(data);
  if (!parsed.success || parsed.data.refeicoes.length !== dadosUsuario.refeicoes) {
    throw new Error('A IA retornou um plano incompleto. Tente novamente.');
  }
  return parsed.data;
};

export const perguntarChatIA = async (
  pergunta: string,
  contextoUsuario: ChatContext,
  historico: ChatHistoryMessage[],
  mealPlan?: MealPlan,
): Promise<string> => {
  const payload = {
    question: pergunta,
    context: contextoUsuario,
    history: historico.slice(-10),
    mealPlan,
  };
  let data: unknown;
  try {
    data = await postJSON('/api/chat', payload);
  } catch (error) {
    if (!(error instanceof ApiRequestError) ||
        ![502, 503, 504].includes(error.status ?? 0) ||
        error.code === 'GROQ_AUTH_ERROR' ||
        error.code === 'AI_NOT_CONFIGURED') throw error;
    // One automatic retry lives here; the page only offers manual retry.
    data = await postJSON('/api/chat', payload);
  }
  const parsed = z.object({ answer: z.string().trim().min(1) }).safeParse(data);
  if (!parsed.success) {
    throw new Error('A IA retornou uma resposta inválida. Tente novamente.');
  }
  const answer = parsed.data.answer;
  return answer.includes('procure um nutricionista')
    ? answer
    : `${answer}\n\nPara um acompanhamento individualizado, procure um nutricionista.`;
};
