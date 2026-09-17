import { useState, useRef, useEffect } from 'react';
import { useNutrition } from '@/contexts/NutritionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError, perguntarChatIA } from '@/services/nutritionApi';
import type { ChatHistoryMessage } from '@/services/nutritionApi';
import { useToast } from '@/hooks/use-toast';
import { Send, Bot, User, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type MessageStatus = 'sending' | 'success' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status: MessageStatus;
  replyTo?: string;
}

const STORAGE_KEY = 'nutri-ai-chat-history';
const WELCOME_ID = 'welcome';
const MAX_SAVED_MESSAGES = 20;
const MAX_CONTEXT_MESSAGES = 10;

const createWelcomeMessage = (name?: string): Message => ({
  id: WELCOME_ID,
  role: 'assistant',
  content: `Olá${name ? `, ${name}` : ''}! 👋 Sou seu assistente nutricional virtual. Posso ajudar com dúvidas sobre alimentação, substituições de alimentos, horários de refeições e hábitos saudáveis.\n\nLembre-se: minhas orientações são apenas educativas e não substituem o acompanhamento de um nutricionista profissional.\n\nComo posso ajudar você hoje?`,
  timestamp: new Date(),
  status: 'success',
});

const readSavedMessages = (name?: string): Message[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [createWelcomeMessage(name)];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [createWelcomeMessage(name)];

    const messages = saved.flatMap((entry): Message[] => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== 'string' ||
          (item.role !== 'user' && item.role !== 'assistant') ||
          typeof item.content !== 'string' ||
          (item.status !== 'sending' && item.status !== 'success' && item.status !== 'error')) return [];

      const timestamp = new Date(String(item.timestamp));
      if (Number.isNaN(timestamp.getTime())) return [];

      return [{
        id: item.id,
        role: item.role,
        content: item.content,
        timestamp,
        // A request interrupted by a refresh can be attempted again.
        status: item.status === 'sending' ? 'error' : item.status,
        replyTo: typeof item.replyTo === 'string' ? item.replyTo : undefined,
      }];
    }).slice(-MAX_SAVED_MESSAGES);

    return messages.length ? messages : [createWelcomeMessage(name)];
  } catch {
    return [createWelcomeMessage(name)];
  }
};

const getErrorDescription = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 400:
        return 'Não foi possível enviar a mensagem. Revise os dados e tente novamente.';
      case 429:
        return 'O limite temporário de uso da IA foi atingido. Tente novamente em alguns instantes.';
      case 502:
      case 503:
        return 'O serviço de IA está temporariamente indisponível.';
      case 504:
        return 'A IA demorou mais que o esperado para responder.';
      case null:
        return 'Não foi possível conectar ao servidor.';
    }
  }
  return 'Ocorreu um erro ao processar sua mensagem. Tente novamente.';
};

const Chat = () => {
  const { userData, mealPlan } = useNutrition();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(() => readSavedMessages(userData?.nome));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {
      // The chat still works if browser storage is unavailable.
    }
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const sendQuestion = async (userMessage: Message, replyId: string, currentMessages: Message[]) => {
    requestInFlight.current = true;
    setIsLoading(true);

    const context = {
      objetivo: userData?.objetivo || 'saúde geral',
      perfil: userData?.perfil === 'atleta' ? 'Atleta' : 'Não Atleta',
      restricoes: userData?.restricoes || 'Nenhuma',
    };
    const history: ChatHistoryMessage[] = currentMessages
      .filter(message => message.id !== WELCOME_ID && message.id !== userMessage.id && message.status === 'success')
      .slice(-MAX_CONTEXT_MESSAGES)
      .map(({ role, content }) => ({ role, content }));

    try {
      const answer = await perguntarChatIA(userMessage.content, context, history, mealPlan ?? undefined);
      setMessages(prev => prev.map(message => {
        if (message.id === userMessage.id) return { ...message, status: 'success' };
        if (message.id === replyId) return { ...message, content: answer, status: 'success', timestamp: new Date() };
        return message;
      }));
    } catch (error) {
      const description = getErrorDescription(error);
      setMessages(prev => prev.map(message => {
        if (message.id === userMessage.id) return { ...message, status: 'error' };
        if (message.id === replyId) return { ...message, content: description, status: 'error', timestamp: new Date() };
        return message;
      }));
      toast({ title: 'Não foi possível obter uma resposta', description, variant: 'destructive' });
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || requestInFlight.current) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      status: 'sending',
    };
    const replyId = crypto.randomUUID();
    const pendingReply: Message = {
      id: replyId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'sending',
      replyTo: userMessage.id,
    };
    setMessages(prev => [...prev, userMessage, pendingReply].slice(-MAX_SAVED_MESSAGES));
    setInput('');
    void sendQuestion(userMessage, replyId, messages);
  };

  const handleRetry = (reply: Message) => {
    if (requestInFlight.current || reply.status !== 'error' || !reply.replyTo) return;
    const userMessage = messages.find(message => message.id === reply.replyTo && message.role === 'user');
    if (!userMessage) return;

    setMessages(prev => prev.map(message =>
      message.id === reply.id || message.id === userMessage.id
        ? { ...message, content: message.id === reply.id ? '' : message.content, status: 'sending' }
        : message
    ));
    void sendQuestion(userMessage, reply.id, messages);
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>Assistente Virtual</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">Chat Nutricional</h1>
          <p className="text-sm text-muted-foreground">Tire suas dúvidas sobre alimentação e nutrição</p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50 mb-4 text-xs">
          <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
          <p className="text-muted-foreground">
            Este chat é apenas educativo e não substitui um nutricionista profissional.
            Suas perguntas, restrições e o plano atual são enviados ao provedor de IA para responder.
          </p>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2" aria-live="polite">
          {messages.map((message, index) => (
            <div key={message.id} className={cn('flex gap-3 animate-slide-up', message.role === 'user' && 'flex-row-reverse')}>
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                message.role === 'assistant' ? 'gradient-primary' : 'bg-secondary'
              )}>
                {message.role === 'assistant'
                  ? <Bot className="h-4 w-4 text-primary-foreground" />
                  : <User className="h-4 w-4 text-secondary-foreground" />}
              </div>
              <div className={cn(
                'max-w-[80%] p-4 rounded-2xl',
                message.role === 'assistant' ? 'gradient-card border border-border/50 shadow-soft' : 'bg-primary text-primary-foreground',
                message.status === 'error' && message.role === 'assistant' && 'border-destructive/50'
              )}>
                {message.role === 'assistant' && message.status === 'sending' ? (
                  <div className="flex items-center gap-2" role="status">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Digitando...</span>
                  </div>
                ) : message.status === 'error' && message.role === 'assistant' ? (
                  <>
                    <p className="text-sm font-medium">Não foi possível obter uma resposta.</p>
                    <p className="text-sm mt-2">{message.content}</p>
                    {index === messages.length - 1 && message.replyTo && (
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => handleRetry(message)} disabled={isLoading}>
                        Tentar novamente
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <p className={cn(
                  'text-xs mt-2',
                  message.role === 'assistant' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                )}>
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {messages.length === 1 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map(question => (
                <button key={question} onClick={() => setInput(question)} className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors">
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Digite sua dúvida sobre nutrição..."
            maxLength={1000}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" variant="hero" size="icon" disabled={!input.trim() || isLoading} aria-label="Enviar mensagem">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
