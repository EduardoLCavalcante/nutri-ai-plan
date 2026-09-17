import { ApiError } from './errors.mjs';
import { callGroq } from './groq-client.mjs';
import { generatedPlanSchema } from './schemas.mjs';

export const DISCLAIMER = 'Este plano é apenas educativo e não substitui o acompanhamento com um nutricionista.';

export function calculateEnergy(profile) {
  const tmb = profile.sexo === 'masculino'
    ? 88.362 + 13.397 * profile.peso + 4.799 * profile.altura - 5.677 * profile.idade
    : 447.593 + 9.247 * profile.peso + 3.098 * profile.altura - 4.330 * profile.idade;
  const get = tmb * (profile.perfil === 'atleta' ? 1.725 : 1.55);
  const adjustment = {
    emagrecimento: 0.8,
    hipertrofia: 1.15,
    manutencao: 1,
    saude: 0.95,
  }[profile.objetivo];
  return { tmb: Math.round(tmb), get: Math.round(get), target: Math.round(get * adjustment) };
}

const mealOutputSchema = {
  type: 'object',
  properties: {
    nome: { type: 'string' },
    alimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          quantidade: { type: 'string', description: 'Porção com unidade, por exemplo 100 g ou 1 unidade.' },
          calorias: { type: 'number' },
        },
        required: ['nome', 'quantidade', 'calorias'],
        additionalProperties: false,
      },
    },
  },
  required: ['nome', 'alimentos'],
  additionalProperties: false,
};

function mealPlanResponseFormat(mealCount) {
  // Required keys guarantee exactly N meals. Some strict modes reject minItems/maxItems.
  const mealEntries = Array.from({ length: mealCount }, (_, index) => [`refeicao_${index + 1}`, mealOutputSchema]);
  const mealNames = mealEntries.map(([name]) => name);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'meal_plan',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          calorias_diarias: { type: 'number' },
          macros: {
            type: 'object',
            properties: {
              proteinas: { type: 'string', description: 'Gramas de proteína, por exemplo 120g.' },
              carboidratos: { type: 'string', description: 'Gramas de carboidratos, por exemplo 200g.' },
              gorduras: { type: 'string', description: 'Gramas de gorduras, por exemplo 70g.' },
            },
            required: ['proteinas', 'carboidratos', 'gorduras'],
            additionalProperties: false,
          },
          refeicoes: {
            type: 'object',
            properties: Object.fromEntries(mealEntries),
            required: mealNames,
            additionalProperties: false,
          },
          aviso: { type: 'string' },
        },
        required: ['calorias_diarias', 'macros', 'refeicoes', 'aviso'],
        additionalProperties: false,
      },
    },
  };
}

class InvalidPlanError extends ApiError {
  constructor(message) {
    super(502, 'INVALID_AI_RESPONSE', message);
  }
}

function parseGeneratedPlan(content, expectedMeals) {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new InvalidPlanError('A IA não retornou um plano válido. Tente novamente.');
  let candidate;
  try {
    candidate = JSON.parse(content.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new InvalidPlanError('A IA retornou um JSON inválido. Tente novamente.');
  }
  const meals = candidate?.refeicoes;
  const expectedNames = Array.from({ length: expectedMeals }, (_, index) => `refeicao_${index + 1}`);
  if (!meals || typeof meals !== 'object' || Array.isArray(meals) ||
      Object.keys(meals).length !== expectedMeals || expectedNames.some((name) => !Object.hasOwn(meals, name))) {
    throw new InvalidPlanError('A IA retornou um plano incompleto. Tente novamente.');
  }
  candidate.refeicoes = expectedNames.map((name) => meals[name]);
  const parsed = generatedPlanSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.refeicoes.length !== expectedMeals) {
    throw new InvalidPlanError('A IA retornou um plano incompleto. Tente novamente.');
  }
  return parsed.data;
}

/** Preserve the existing validated plan shape and its one format-repair attempt. */
export async function generateMealPlan(profile, options = {}) {
  // Both format attempts share one deadline, leaving time for the HTTP response
  // before the frontend and Vercel function deadlines.
  const deadline = AbortSignal.timeout(40_000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const energy = calculateEnergy(profile);
  const mealNames = Array.from({ length: profile.refeicoes }, (_, index) => `refeicao_${index + 1}`);
  const messages = [
    {
      role: 'system',
      content: `Você é um assistente de educação alimentar no Brasil. Crie um plano diário educativo, com alimentos comuns e quantidades plausíveis. Não prescreva tratamento nem substitua nutricionista. Siga o JSON Schema informado. Apenas calorias_diarias e alimentos[].calorias são números JSON. Todas as macros são strings no formato número seguido de g; cada quantidade é uma string que inclui porção e unidade, como "100 g" ou "1 unidade". Inclua exatamente o número de refeições pedido e ao menos um alimento por refeição. Some as calorias de cada alimento antes de responder; calorias_diarias deve ser igual à soma de todos os alimentos. O aviso deve informar que o plano não substitui acompanhamento com nutricionista.`,
    },
    {
      role: 'user',
      content: `Monte o plano diário para estes dados (sem nome): ${JSON.stringify(profile)}. TMB estimada ${energy.tmb} kcal, GET estimado ${energy.get} kcal e meta diária ${energy.target} kcal. O objeto refeicoes deve ter exatamente as chaves ${mealNames.join(', ')}, cada uma com uma refeição completa e ao menos um alimento. A soma de todos os alimentos deve ficar entre ${Math.round(energy.target * 0.9)} e ${Math.round(energy.target * 1.1)} kcal; confira essa soma e use-a em calorias_diarias. O período de ${profile.tempo} dias é o horizonte do objetivo; apresente somente um dia representativo.`,
    },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages = attempt === 0 ? messages : [
      ...messages,
      {
        role: 'user',
        content: `A geração anterior não cumpriu o formato ou a meta. Refaça o plano inteiro: preencha todas as chaves ${mealNames.join(', ')}, use porções com unidade e mantenha a soma dos alimentos entre ${Math.round(energy.target * 0.9)} e ${Math.round(energy.target * 1.1)} kcal. Confira a soma antes de responder.`,
      },
    ];
    try {
      const content = await callGroq({
        ...options,
        signal,
        messages: attemptMessages,
        maxTokens: 4000,
        temperature: 0.2,
        responseFormat: mealPlanResponseFormat(profile.refeicoes),
      });
      const plan = parseGeneratedPlan(content, profile.refeicoes);
      const listedCalories = plan.refeicoes.reduce(
        (total, meal) => total + meal.alimentos.reduce((mealTotal, food) => mealTotal + food.calorias, 0),
        0,
      );
      if (Math.abs(listedCalories - energy.target) > energy.target * 0.25) {
        throw new InvalidPlanError('A IA retornou calorias inconsistentes. Tente gerar o plano novamente.');
      }
      return {
        ...plan,
        calorias_diarias: Math.round(listedCalories),
        aviso: DISCLAIMER,
        tmb: energy.tmb,
        get: energy.get,
      };
    } catch (error) {
      if (!(error instanceof InvalidPlanError) && !(error instanceof ApiError && error.code === 'INVALID_AI_RESPONSE')) throw error;
      if (attempt === 1) throw error;
    }
  }
}
