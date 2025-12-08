import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Salad, 
  Brain, 
  Calculator, 
  MessageCircle, 
  ClipboardList, 
  ArrowRight,
  Sparkles,
  Shield,
  Clock
} from 'lucide-react';

const Index = () => {
  const features = [
    {
      icon: ClipboardList,
      title: 'Formulário Personalizado',
      description: 'Preencha seus dados, objetivos e preferências alimentares para um plano sob medida.',
    },
    {
      icon: Calculator,
      title: 'Cálculos Precisos',
      description: 'Calculamos sua TMB e GET automaticamente para definir suas necessidades calóricas.',
    },
    {
      icon: Brain,
      title: 'IA Nutricional',
      description: 'Nossa inteligência artificial gera um plano alimentar completo e balanceado.',
    },
    {
      icon: MessageCircle,
      title: 'Chat Educativo',
      description: 'Tire suas dúvidas sobre alimentação com nosso assistente virtual.',
    },
  ];

  const steps = [
    { number: '01', title: 'Preencha o Formulário', description: 'Informe seus dados pessoais e objetivos' },
    { number: '02', title: 'Aguarde a IA', description: 'Processamos suas informações com inteligência artificial' },
    { number: '03', title: 'Receba seu Plano', description: 'Visualize seu plano alimentar personalizado' },
    { number: '04', title: 'Tire Dúvidas', description: 'Use o chat para esclarecer qualquer questão' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-slide-up">
              <Sparkles className="h-4 w-4" />
              <span>Powered by Artificial Intelligence</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Seu Plano Alimentar
              <span className="block text-primary">Personalizado com IA</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
              O <strong className="text-foreground">Nutri AI</strong> utiliza inteligência artificial para criar 
              planos alimentares adaptados aos seus objetivos, restrições e preferências.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Link to="/formulario">
                <Button variant="hero" size="xl">
                  Criar Meu Plano
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/chat">
                <Button variant="outline" size="xl">
                  <MessageCircle className="h-5 w-5" />
                  Chat Nutricional
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-6 mt-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                <span>Fins Educacionais</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>Resultado Instantâneo</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Salad className="h-4 w-4 text-primary" />
                <span>100% Personalizado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como Funciona
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Um processo simples e eficiente para você alcançar seus objetivos nutricionais
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group p-6 rounded-2xl gradient-card border border-border/50 shadow-soft hover:shadow-card transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow duration-300">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Passo a Passo
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Siga estes passos simples para obter seu plano alimentar personalizado
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div 
                key={step.number}
                className="flex items-start gap-4 mb-8 last:mb-0 animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-primary-foreground shadow-soft">
                  {step.number}
                </div>
                <div className="pt-2">
                  <h3 className="font-display font-semibold text-lg text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pronto para Começar?
            </h2>
            <p className="text-muted-foreground mb-8">
              Crie seu plano alimentar personalizado agora mesmo e dê o primeiro passo 
              em direção a uma alimentação mais saudável.
            </p>
            <Link to="/formulario">
              <Button variant="hero" size="xl">
                Começar Agora
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
