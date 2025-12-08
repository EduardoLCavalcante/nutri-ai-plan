import { UserData, MealPlan, Refeicao } from '@/contexts/NutritionContext';

const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

interface HuggingFaceResponse {
  generated_text: string;
}

const getHFToken = (): string => {
  const token = import.meta.env.VITE_HF_TOKEN;
  if (!token) {
    throw new Error('Token do Hugging Face não configurado. Configure VITE_HF_TOKEN no arquivo .env');
  }
  return token;
};

const callHuggingFaceAPI = async (prompt: string): Promise<string> => {
  const token = getHFToken();
  
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 2000,
        temperature: 0.7,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      throw new Error('Token do Hugging Face inválido ou expirado.');
    }
    if (response.status === 503) {
      throw new Error('O modelo está carregando. Por favor, aguarde alguns segundos e tente novamente.');
    }
    if (response.status === 429) {
      throw new Error('Limite de requisições excedido. Aguarde um momento e tente novamente.');
    }
    
    throw new Error(errorData.error || 'Erro ao se comunicar com a IA.');
  }

  const data: HuggingFaceResponse[] = await response.json();
  
  if (!data || !data[0]?.generated_text) {
    throw new Error('Resposta inválida da IA.');
  }

  return data[0].generated_text;
};

const buildMealPlanPrompt = (userData: UserData): string => {
  return `<s>[INST] Você é um assistente nutricional virtual para fins educacionais. 
Sua função é montar um plano alimentar personalizado com base nos dados fornecidos pelo usuário.

Você deve obrigatoriamente:
- Não substituir um nutricionista profissional
- Adaptar o plano ao objetivo, perfil e restrições
- Usar alimentos comuns e acessíveis no Brasil
- Distribuir corretamente as refeições ao longo do dia
- Informar os macronutrientes aproximados
- Informar calorias estimadas
- Manter linguagem clara e educativa

DADOS DO USUÁRIO:
Nome: ${userData.nome}
Idade: ${userData.idade}
Sexo: ${userData.sexo}
Altura: ${userData.altura}cm
Peso: ${userData.peso}kg
Perfil: ${userData.perfil === 'atleta' ? 'Atleta' : 'Não Atleta'}
Objetivo: ${userData.objetivo}
Tempo de planejamento: ${userData.tempo} dias
Refeições por dia: ${userData.refeicoes}
Restrições: ${userData.restricoes || 'Nenhuma'}
Preferências alimentares: ${userData.preferencias || 'Nenhuma'}
Alimentos que não gosta: ${userData.alimentosNaoGosta || 'Nenhum'}

TAREFA:
1) Calcule a Taxa Metabólica Basal (TMB)
2) Calcule o Gasto Energético Diário (GET)
3) Ajuste as calorias de acordo com o objetivo
4) Gere um plano alimentar diário dividido conforme o número de refeições (${userData.refeicoes} refeições)
5) Para cada refeição informe: Alimentos, Quantidades aproximadas, Calorias médias

6) Mostre no final:
- Total de calorias do dia
- Proteínas (g)
- Carboidratos (g)
- Gorduras (g)

7) Finalize com: "Este plano é apenas educativo e não substitui o acompanhamento com um nutricionista."

IMPORTANTE: Retorne APENAS um JSON válido neste formato exato, sem texto adicional antes ou depois:

{
  "calorias_diarias": 2000,
  "macros": {
    "proteinas": "120g",
    "carboidratos": "200g",
    "gorduras": "70g"
  },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "alimentos": [
        { "nome": "Alimento", "quantidade": "Porção", "calorias": 100 }
      ]
    }
  ],
  "aviso": "Este plano é apenas educativo e não substitui o acompanhamento com um nutricionista.",
  "tmb": 1500,
  "get": 2000
}
[/INST]</s>`;
};

const parseJSONFromResponse = (response: string): MealPlan => {
  // Tentar encontrar JSON na resposta
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Não foi possível extrair o plano alimentar da resposta.');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validar estrutura básica
    if (!parsed.calorias_diarias || !parsed.macros || !parsed.refeicoes) {
      throw new Error('Estrutura do plano alimentar incompleta.');
    }

    return {
      calorias_diarias: parsed.calorias_diarias,
      macros: {
        proteinas: parsed.macros.proteinas,
        carboidratos: parsed.macros.carboidratos,
        gorduras: parsed.macros.gorduras,
      },
      refeicoes: parsed.refeicoes as Refeicao[],
      aviso: parsed.aviso || 'Este plano é apenas educativo e não substitui o acompanhamento com um nutricionista.',
      tmb: parsed.tmb || 0,
      get: parsed.get || 0,
    };
  } catch (error) {
    throw new Error('Erro ao processar resposta da IA. Tente novamente.');
  }
};

export const gerarPlanoIA = async (dadosUsuario: UserData): Promise<MealPlan> => {
  const prompt = buildMealPlanPrompt(dadosUsuario);
  const response = await callHuggingFaceAPI(prompt);
  return parseJSONFromResponse(response);
};

interface ChatContext {
  objetivo: string;
  perfil: string;
  restricoes: string;
}

const buildChatPrompt = (pergunta: string, contexto: ChatContext): string => {
  return `<s>[INST] Você é um assistente virtual especializado em educação alimentar e nutrição.

REGRAS IMPORTANTES:
- Nunca prescreva dietas como um profissional
- Nunca substitua um nutricionista
- Responda de forma clara, simples e educativa
- Sempre incentive hábitos saudáveis
- Se houver risco à saúde, recomende procurar um profissional
- Responda em português do Brasil

CONTEXTO DO USUÁRIO:
Objetivo: ${contexto.objetivo}
Perfil: ${contexto.perfil}
Restrições: ${contexto.restricoes || 'Nenhuma'}

PERGUNTA DO USUÁRIO:
${pergunta}

TAREFA:
Responda a pergunta de forma objetiva, educativa e responsável.

Finalize sempre com:
"Para um acompanhamento individualizado, procure um nutricionista."
[/INST]</s>`;
};

export const perguntarChatIA = async (
  pergunta: string, 
  contextoUsuario: ChatContext
): Promise<string> => {
  const prompt = buildChatPrompt(pergunta, contextoUsuario);
  const response = await callHuggingFaceAPI(prompt);
  
  // Limpar a resposta
  let cleanResponse = response.trim();
  
  // Garantir que termine com o aviso
  if (!cleanResponse.includes('procure um nutricionista')) {
    cleanResponse += '\n\nPara um acompanhamento individualizado, procure um nutricionista.';
  }
  
  return cleanResponse;
};

export const isHFTokenConfigured = (): boolean => {
  return !!import.meta.env.VITE_HF_TOKEN;
};
