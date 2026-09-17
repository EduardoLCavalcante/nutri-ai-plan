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
    throw new Error(message);
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
      throw new Error('A IA demorou para responder. Tente novamente.');
    }
    if (error instanceof TypeError) {
      throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
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
  const data = await postJSON('/api/chat', {
    question: pergunta,
    context: contextoUsuario,
    history: historico.slice(-10),
    mealPlan,
  });
  const parsed = z.object({ answer: z.string().trim().min(1) }).safeParse(data);
  if (!parsed.success) {
    throw new Error('A IA retornou uma resposta inválida. Tente novamente.');
  }
  const answer = parsed.data.answer;
  return answer.includes('procure um nutricionista')
    ? answer
    : `${answer}\n\nPara um acompanhamento individualizado, procure um nutricionista.`;
};
