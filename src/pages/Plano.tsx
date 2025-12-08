import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNutrition } from '@/contexts/NutritionContext';
import { Button } from '@/components/ui/button';
import { 
  Flame, 
  Beef, 
  Wheat, 
  Droplet, 
  ArrowLeft, 
  MessageCircle,
  RefreshCw,
  Calculator,
  Zap,
  AlertTriangle,
  UtensilsCrossed
} from 'lucide-react';

const Plano = () => {
  const navigate = useNavigate();
  const { userData, mealPlan, clearData } = useNutrition();

  useEffect(() => {
    if (!userData || !mealPlan) {
      navigate('/formulario');
    }
  }, [userData, mealPlan, navigate]);

  if (!userData || !mealPlan) {
    return null;
  }

  const objetivoLabels = {
    emagrecimento: 'Emagrecimento',
    hipertrofia: 'Hipertrofia',
    manutencao: 'Manutenção',
    saude: 'Saúde',
  };

  const handleNewPlan = () => {
    clearData();
    navigate('/formulario');
  };

  return (
    <div className="py-12 animate-fade-in">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Seu Plano Alimentar
          </h1>
          <p className="text-muted-foreground">
            Olá, <strong className="text-foreground">{userData.nome}</strong>! 
            Aqui está seu plano personalizado para <strong className="text-primary">{objetivoLabels[userData.objetivo]}</strong>.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/50 mb-8">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            {mealPlan.aviso}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl gradient-card border border-border/50 shadow-soft text-center">
            <div className="gradient-primary w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Calculator className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">TMB</p>
            <p className="font-display font-bold text-xl text-foreground">{mealPlan.tmb}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>

          <div className="p-4 rounded-2xl gradient-card border border-border/50 shadow-soft text-center">
            <div className="gradient-primary w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">GET</p>
            <p className="font-display font-bold text-xl text-foreground">{mealPlan.get}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>

          <div className="p-4 rounded-2xl gradient-card border border-border/50 shadow-soft text-center col-span-2">
            <div className="gradient-primary w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Meta Diária</p>
            <p className="font-display font-bold text-2xl text-foreground">{mealPlan.calorias_diarias}</p>
            <p className="text-xs text-muted-foreground">kcal/dia</p>
          </div>
        </div>

        {/* Macros */}
        <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft mb-8">
          <h2 className="font-display font-semibold text-xl text-foreground mb-6 text-center">
            Distribuição de Macronutrientes
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-secondary/50">
              <Beef className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="font-display font-bold text-xl text-foreground">{mealPlan.macros.proteinas}</p>
              <p className="text-sm text-muted-foreground">Proteínas</p>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-secondary/50">
              <Wheat className="h-6 w-6 text-accent mx-auto mb-2" />
              <p className="font-display font-bold text-xl text-foreground">{mealPlan.macros.carboidratos}</p>
              <p className="text-sm text-muted-foreground">Carboidratos</p>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-secondary/50">
              <Droplet className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="font-display font-bold text-xl text-foreground">{mealPlan.macros.gorduras}</p>
              <p className="text-sm text-muted-foreground">Gorduras</p>
            </div>
          </div>
        </div>

        {/* Meals */}
        <div className="space-y-4 mb-8">
          <h2 className="font-display font-semibold text-xl text-foreground flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Refeições do Dia
          </h2>

          {mealPlan.refeicoes.map((refeicao, index) => {
            const totalCalorias = refeicao.alimentos.reduce((acc, a) => acc + a.calorias, 0);
            
            return (
              <div 
                key={index} 
                className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg text-foreground">
                    {refeicao.nome}
                  </h3>
                  <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {totalCalorias} kcal
                  </span>
                </div>
                
                <div className="space-y-2">
                  {refeicao.alimentos.map((alimento, aIndex) => (
                    <div 
                      key={aIndex}
                      className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-foreground">{alimento.nome}</p>
                        <p className="text-sm text-muted-foreground">{alimento.quantidade}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{alimento.calorias} kcal</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" className="flex-1" onClick={handleNewPlan}>
            <RefreshCw className="h-4 w-4" />
            Novo Plano
          </Button>
          
          <Link to="/chat" className="flex-1">
            <Button variant="hero" className="w-full">
              <MessageCircle className="h-4 w-4" />
              Tirar Dúvidas no Chat
            </Button>
          </Link>
        </div>

        <div className="mt-4">
          <Link to="/">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Plano;
