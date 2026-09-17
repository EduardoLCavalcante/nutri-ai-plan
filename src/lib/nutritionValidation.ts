import { z } from 'zod';

export const userDataSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  idade: z.number().int().min(18).max(100),
  sexo: z.enum(['masculino', 'feminino']),
  altura: z.number().finite().min(100).max(250),
  peso: z.number().finite().min(30).max(400),
  perfil: z.enum(['atleta', 'nao_atleta']),
  objetivo: z.enum(['emagrecimento', 'hipertrofia', 'manutencao', 'saude']),
  tempo: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  refeicoes: z.number().int().min(3).max(6),
  restricoes: z.string().max(500),
  preferencias: z.string().max(500),
  alimentosNaoGosta: z.string().max(500),
});
