import { useState, useRef, useEffect } from 'react';
import { useNutrition } from '@/contexts/NutritionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  Bot, 
  User, 
  AlertTriangle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const Chat = () => {
  const { userData } = useNutrition();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá${userData ? `, ${userData.nome}` : ''}! 👋 Sou seu assistente nutricional virtual. Posso ajudar com dúvidas sobre alimentação, substituições de alimentos, horários de refeições e hábitos saudáveis.\n\nLembre-se: minhas orientações são apenas educativas e não substituem o acompanhamento de um nutricionista profissional.\n\nComo posso ajudar você hoje?`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateMockResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    // Respostas mockadas baseadas em palavras-chave
    if (lowerQuestion.includes('emagrecer') || lowerQuestion.includes('perder peso')) {
      return `Para um processo de emagrecimento saudável, recomendo:

1. **Déficit calórico moderado**: Reduza cerca de 300-500 kcal do seu gasto diário
2. **Proteínas adequadas**: Mantenha cerca de 1.6g por kg de peso corporal
3. **Hidratação**: Beba pelo menos 35ml de água por kg de peso
4. **Sono de qualidade**: Durma 7-8 horas por noite
5. **Atividade física regular**: Combine exercícios aeróbicos e de força

Evite dietas muito restritivas, pois podem causar efeito sanfona e deficiências nutricionais.

Para um acompanhamento individualizado, procure um nutricionista.`;
    }

    if (lowerQuestion.includes('proteína') || lowerQuestion.includes('proteinas')) {
      return `As proteínas são essenciais para diversas funções do organismo:

**Fontes de proteína de qualidade:**
- 🥚 Ovos (6g por unidade)
- 🍗 Frango (27g por 100g)
- 🐟 Peixes (20-25g por 100g)
- 🥛 Leite e derivados
- 🫘 Leguminosas (feijão, lentilha, grão-de-bico)

**Quantidade recomendada:**
- Sedentários: 0.8-1g por kg de peso
- Ativos: 1.2-1.6g por kg de peso
- Atletas/Hipertrofia: 1.6-2.2g por kg de peso

Distribua a ingestão ao longo do dia para melhor absorção.

Para um acompanhamento individualizado, procure um nutricionista.`;
    }

    if (lowerQuestion.includes('substituir') || lowerQuestion.includes('trocar')) {
      return `Substituições inteligentes de alimentos:

**Carboidratos:**
- Arroz branco → Arroz integral, quinoa
- Pão branco → Pão integral, tapioca
- Batata inglesa → Batata doce, inhame

**Proteínas:**
- Carne vermelha → Frango, peixe, ovos
- Leite de vaca → Leite vegetal fortificado

**Gorduras:**
- Manteiga → Azeite de oliva
- Frituras → Preparações assadas ou grelhadas

O importante é manter o equilíbrio nutricional nas substituições!

Para um acompanhamento individualizado, procure um nutricionista.`;
    }

    if (lowerQuestion.includes('horário') || lowerQuestion.includes('quando comer')) {
      return `O timing das refeições pode influenciar seus resultados:

**Café da manhã**: Até 1h após acordar
**Lanche da manhã**: 2-3h após o café
**Almoço**: Entre 12h-14h
**Lanche da tarde**: 2-3h após o almoço
**Jantar**: Até 3h antes de dormir

**Dicas importantes:**
- Evite intervalos maiores que 4h entre refeições
- Não pule refeições, especialmente o café da manhã
- O pré e pós-treino merecem atenção especial

Para um acompanhamento individualizado, procure um nutricionista.`;
    }

    // Resposta genérica
    return `Obrigado pela sua pergunta! A nutrição é uma ciência complexa e cada pessoa tem necessidades individuais.

De forma geral, para uma alimentação saudável, recomendo:

1. **Variedade**: Consuma alimentos de todos os grupos
2. **Moderação**: Evite excessos, mesmo de alimentos saudáveis
3. **Equilíbrio**: Distribua bem carboidratos, proteínas e gorduras
4. **Hidratação**: Mantenha-se bem hidratado
5. **Qualidade**: Prefira alimentos naturais e minimamente processados

Se você tiver dúvidas mais específicas sobre alimentação, emagrecimento, hipertrofia ou substituições de alimentos, é só perguntar!

Para um acompanhamento individualizado, procure um nutricionista.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simular delay de resposta
    await new Promise(resolve => setTimeout(resolve, 1500));

    const response = generateMockResponse(userMessage.content);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const suggestedQuestions = [
    'Como posso emagrecer de forma saudável?',
    'Quais são as melhores fontes de proteína?',
    'Como substituir alimentos na dieta?',
    'Qual o melhor horário para cada refeição?',
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      <div className="container mx-auto px-4 py-6 flex flex-col h-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>Assistente Virtual</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Chat Nutricional
          </h1>
          <p className="text-sm text-muted-foreground">
            Tire suas dúvidas sobre alimentação e nutrição
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50 mb-4 text-xs">
          <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
          <p className="text-muted-foreground">
            Este chat é apenas educativo e não substitui um nutricionista profissional.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-slide-up",
                message.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                message.role === 'assistant' 
                  ? 'gradient-primary' 
                  : 'bg-secondary'
              )}>
                {message.role === 'assistant' ? (
                  <Bot className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <User className="h-4 w-4 text-secondary-foreground" />
                )}
              </div>
              
              <div className={cn(
                "max-w-[80%] p-4 rounded-2xl",
                message.role === 'assistant' 
                  ? 'gradient-card border border-border/50 shadow-soft' 
                  : 'bg-primary text-primary-foreground'
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={cn(
                  "text-xs mt-2",
                  message.role === 'assistant' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                )}>
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="p-4 rounded-2xl gradient-card border border-border/50 shadow-soft">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Digitando...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInput(question)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida sobre nutrição..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            variant="hero" 
            size="icon"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
