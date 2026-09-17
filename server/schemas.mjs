import { z } from 'zod';

const requiredText = (max) => z.string().trim().min(1).max(max);
const optionalText = z.string().trim().max(500).default('');

export const profileSchema = z.object({
  idade: z.number().int().min(18).max(100),
  sexo: z.enum(['masculino', 'feminino']),
  altura: z.number().finite().min(100).max(250),
  peso: z.number().finite().min(30).max(400),
  perfil: z.enum(['atleta', 'nao_atleta']),
  objetivo: z.enum(['emagrecimento', 'hipertrofia', 'manutencao', 'saude']),
  tempo: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  refeicoes: z.number().int().min(3).max(6),
  restricoes: optionalText,
  preferencias: optionalText,
  alimentosNaoGosta: optionalText,
});

const gramValue = requiredText(30).regex(/^\d+(?:[.,]\d+)?\s?g$/i);
const foodSchema = z.object({
  nome: requiredText(100),
  quantidade: requiredText(100),
  calorias: z.number().finite().min(0).max(1500),
});
const mealSchema = z.object({
  nome: requiredText(100),
  alimentos: z.array(foodSchema).min(1).max(15),
});

export const generatedPlanSchema = z.object({
  calorias_diarias: z.number().finite().min(500).max(20000),
  macros: z.object({
    proteinas: gramValue,
    carboidratos: gramValue,
    gorduras: gramValue,
  }),
  refeicoes: z.array(mealSchema).min(3).max(6),
  aviso: z.string().trim().max(500).optional(),
});

export const mealPlanSchema = generatedPlanSchema.extend({
  aviso: requiredText(500),
  tmb: z.number().finite().positive(),
  get: z.number().finite().positive(),
});

export const mealPlanRequestSchema = z.object({ profile: profileSchema });
export const chatRequestSchema = z.object({
  question: requiredText(1000),
  context: z.object({
    objetivo: requiredText(100),
    perfil: requiredText(100),
    restricoes: z.string().trim().max(500),
  }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: requiredText(2000),
  })).max(20),
  mealPlan: mealPlanSchema.optional(),
});
