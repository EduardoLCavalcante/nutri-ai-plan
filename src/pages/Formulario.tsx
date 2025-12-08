import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNutrition, UserData } from '@/contexts/NutritionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { gerarPlanoIA, isHFTokenConfigured } from '@/services/huggingFaceApi';
import { 
  User, 
  Ruler, 
  Scale, 
  Target, 
  Calendar, 
  Utensils,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';

const Formulario = () => {
  const navigate = useNavigate();
  const { setUserData, setMealPlan, setIsLoading, isLoading } = useNutrition();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<UserData>>({
    nome: '',
    idade: undefined,
    sexo: undefined,
    altura: undefined,
    peso: undefined,
    perfil: undefined,
    objetivo: undefined,
    tempo: undefined,
    refeicoes: 4,
    restricoes: '',
    preferencias: '',
    alimentosNaoGosta: '',
  });

  const handleInputChange = (field: keyof UserData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateTMB = (data: UserData): number => {
    // Harris-Benedict Formula
    if (data.sexo === 'masculino') {
      return 88.362 + (13.397 * data.peso) + (4.799 * data.altura) - (5.677 * data.idade);
    } else {
      return 447.593 + (9.247 * data.peso) + (3.098 * data.altura) - (4.330 * data.idade);
    }
  };

  const calculateGET = (tmb: number, perfil: string): number => {
    // Factor de atividade
    const factor = perfil === 'atleta' ? 1.725 : 1.55;
    return tmb * factor;
  };

  const adjustCalories = (get: number, objetivo: string): number => {
    switch (objetivo) {
      case 'emagrecimento':
        return get * 0.8; // 20% déficit
      case 'hipertrofia':
        return get * 1.15; // 15% superávit
      case 'manutencao':
        return get;
      case 'saude':
        return get * 0.95; // 5% déficit leve
      default:
        return get;
    }
  };

  const generateMockMealPlan = (data: UserData, tmb: number, get: number, adjustedCalories: number) => {
    const proteinGrams = Math.round(data.peso * (data.objetivo === 'hipertrofia' ? 2 : 1.6));
    const fatGrams = Math.round((adjustedCalories * 0.25) / 9);
    const carbGrams = Math.round((adjustedCalories - (proteinGrams * 4) - (fatGrams * 9)) / 4);

    const refeicoesPadrao = [
      {
        nome: 'Café da manhã',
        alimentos: [
          { nome: 'Ovos mexidos', quantidade: '2 unidades', calorias: 140 },
          { nome: 'Pão integral', quantidade: '2 fatias', calorias: 140 },
          { nome: 'Banana', quantidade: '1 unidade média', calorias: 90 },
          { nome: 'Café sem açúcar', quantidade: '1 xícara', calorias: 5 },
        ]
      },
      {
        nome: 'Lanche da manhã',
        alimentos: [
          { nome: 'Iogurte natural', quantidade: '170g', calorias: 100 },
          { nome: 'Granola', quantidade: '30g', calorias: 120 },
        ]
      },
      {
        nome: 'Almoço',
        alimentos: [
          { nome: 'Arroz integral', quantidade: '4 colheres de sopa', calorias: 140 },
          { nome: 'Feijão', quantidade: '2 colheres de sopa', calorias: 80 },
          { nome: 'Frango grelhado', quantidade: '150g', calorias: 230 },
          { nome: 'Salada de folhas', quantidade: '1 prato', calorias: 25 },
          { nome: 'Azeite de oliva', quantidade: '1 colher de sopa', calorias: 90 },
        ]
      },
      {
        nome: 'Lanche da tarde',
        alimentos: [
          { nome: 'Maçã', quantidade: '1 unidade', calorias: 80 },
          { nome: 'Amendoim', quantidade: '30g', calorias: 170 },
        ]
      },
      {
        nome: 'Jantar',
        alimentos: [
          { nome: 'Peixe grelhado', quantidade: '150g', calorias: 180 },
          { nome: 'Batata doce', quantidade: '150g', calorias: 130 },
          { nome: 'Legumes cozidos', quantidade: '1 xícara', calorias: 60 },
        ]
      },
      {
        nome: 'Ceia',
        alimentos: [
          { nome: 'Queijo cottage', quantidade: '100g', calorias: 100 },
        ]
      },
    ];

    // Ajustar número de refeições
    const refeicoesAjustadas = refeicoesPadrao.slice(0, data.refeicoes);

    return {
      calorias_diarias: Math.round(adjustedCalories),
      macros: {
        proteinas: `${proteinGrams}g`,
        carboidratos: `${carbGrams}g`,
        gorduras: `${fatGrams}g`,
      },
      refeicoes: refeicoesAjustadas,
      aviso: 'Este plano é apenas educativo e não substitui o acompanhamento com um nutricionista profissional.',
      tmb: Math.round(tmb),
      get: Math.round(get),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    const requiredFields: (keyof UserData)[] = ['nome', 'idade', 'sexo', 'altura', 'peso', 'perfil', 'objetivo', 'tempo'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se o token está configurado
    if (!isHFTokenConfigured()) {
      toast({
        title: 'Configuração necessária',
        description: 'O token do Hugging Face não está configurado. Configure VITE_HF_TOKEN no arquivo .env',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userData = formData as UserData;
      setUserData(userData);

      // Gerar plano alimentar usando IA real
      const mealPlan = await gerarPlanoIA(userData);
      
      // Se a IA não retornou TMB/GET, calcular localmente
      if (!mealPlan.tmb || !mealPlan.get) {
        const tmb = calculateTMB(userData);
        const get = calculateGET(tmb, userData.perfil);
        mealPlan.tmb = Math.round(tmb);
        mealPlan.get = Math.round(get);
      }
      
      setMealPlan(mealPlan);

      toast({
        title: 'Plano gerado com sucesso!',
        description: 'Seu plano alimentar personalizado foi criado pela IA.',
      });

      navigate('/plano');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
      toast({
        title: 'Erro ao gerar plano',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12 animate-fade-in">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Crie seu Plano Alimentar
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Preencha o formulário abaixo com suas informações para que possamos 
            gerar um plano alimentar personalizado para você.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/50 mb-8">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Lembre-se:</strong> Este é um aplicativo educacional. 
            O plano gerado não substitui a orientação de um nutricionista profissional.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft">
            <h2 className="font-display font-semibold text-xl text-foreground mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados Pessoais
            </h2>
            
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Seu nome completo"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="idade">Idade *</Label>
                  <Input
                    id="idade"
                    type="number"
                    placeholder="Ex: 25"
                    value={formData.idade || ''}
                    onChange={(e) => handleInputChange('idade', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Sexo *</Label>
                  <RadioGroup
                    value={formData.sexo}
                    onValueChange={(value) => handleInputChange('sexo', value)}
                    className="flex gap-4 pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="masculino" id="masculino" />
                      <Label htmlFor="masculino" className="font-normal cursor-pointer">Masculino</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="feminino" id="feminino" />
                      <Label htmlFor="feminino" className="font-normal cursor-pointer">Feminino</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>

          {/* Medidas */}
          <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft">
            <h2 className="font-display font-semibold text-xl text-foreground mb-6 flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary" />
              Medidas Corporais
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="altura">Altura (cm) *</Label>
                <Input
                  id="altura"
                  type="number"
                  placeholder="Ex: 170"
                  value={formData.altura || ''}
                  onChange={(e) => handleInputChange('altura', parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="peso">Peso (kg) *</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 70.5"
                  value={formData.peso || ''}
                  onChange={(e) => handleInputChange('peso', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Perfil e Objetivo */}
          <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft">
            <h2 className="font-display font-semibold text-xl text-foreground mb-6 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Perfil e Objetivo
            </h2>
            
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label>Perfil *</Label>
                <RadioGroup
                  value={formData.perfil}
                  onValueChange={(value) => handleInputChange('perfil', value)}
                  className="flex gap-4 pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="atleta" id="atleta" />
                    <Label htmlFor="atleta" className="font-normal cursor-pointer">Atleta</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao_atleta" id="nao_atleta" />
                    <Label htmlFor="nao_atleta" className="font-normal cursor-pointer">Não Atleta</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid gap-2">
                <Label>Objetivo *</Label>
                <Select
                  value={formData.objetivo}
                  onValueChange={(value) => handleInputChange('objetivo', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                    <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="saude">Saúde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Planejamento */}
          <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft">
            <h2 className="font-display font-semibold text-xl text-foreground mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Planejamento
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tempo de planejamento *</Label>
                <Select
                  value={formData.tempo?.toString()}
                  onValueChange={(value) => handleInputChange('tempo', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Refeições por dia *</Label>
                <Select
                  value={formData.refeicoes?.toString()}
                  onValueChange={(value) => handleInputChange('refeicoes', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 refeições</SelectItem>
                    <SelectItem value="4">4 refeições</SelectItem>
                    <SelectItem value="5">5 refeições</SelectItem>
                    <SelectItem value="6">6 refeições</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Preferências */}
          <div className="p-6 rounded-2xl gradient-card border border-border/50 shadow-soft">
            <h2 className="font-display font-semibold text-xl text-foreground mb-6 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Preferências Alimentares
            </h2>
            
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="restricoes">Restrições Alimentares</Label>
                <Textarea
                  id="restricoes"
                  placeholder="Ex: Intolerância à lactose, alergia a glúten..."
                  value={formData.restricoes}
                  onChange={(e) => handleInputChange('restricoes', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="preferencias">Preferências Alimentares</Label>
                <Textarea
                  id="preferencias"
                  placeholder="Ex: Vegetariano, vegano, low carb..."
                  value={formData.preferencias}
                  onChange={(e) => handleInputChange('preferencias', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="naoGosta">Alimentos que não gosta</Label>
                <Textarea
                  id="naoGosta"
                  placeholder="Ex: Brócolis, fígado, beterraba..."
                  value={formData.alimentosNaoGosta}
                  onChange={(e) => handleInputChange('alimentosNaoGosta', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            variant="hero" 
            size="xl" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando seu plano...
              </>
            ) : (
              <>
                Gerar Plano Alimentar
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Formulario;
