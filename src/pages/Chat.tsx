import { useState, useRef, useEffect } from 'react';
import { useNutrition } from '@/contexts/NutritionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { perguntarChatIA, isHFTokenConfigured } from '@/services/huggingFaceApi';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Verificar se o token está configurado
    if (!isHFTokenConfigured()) {
      toast({
        title: 'Configuração necessária',
        description: 'O token do Hugging Face não está configurado. Configure VITE_HF_TOKEN no arquivo .env',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const contexto = {
        objetivo: userData?.objetivo || 'saúde geral',
        perfil: userData?.perfil === 'atleta' ? 'Atleta' : 'Não Atleta',
        restricoes: userData?.restricoes || 'Nenhuma',
      };

      const response = await perguntarChatIA(userMessage.content, contexto);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro ao processar sua mensagem.';
      
      toast({
        title: 'Erro na resposta',
        description: errorMessage,
        variant: 'destructive',
      });

      // Adicionar mensagem de erro no chat
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Desculpe, não consegui processar sua pergunta. ${errorMessage}\n\nPor favor, tente novamente em alguns instantes.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
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
