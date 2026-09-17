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
import { gerarPlanoIA } from '@/services/nutritionApi';
import { userDataSchema } from '@/lib/nutritionValidation';
import { 
  User, 
  Ruler, 
  Target, 
  Calendar, 
  Utensils,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';

const Formulario = () => {
  const navigate = useNavigate();
  const { setPlanResult, setIsLoading, isLoading } = useNutrition();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validated = userDataSchema.safeParse(formData);
    if (!validated.success) {
      toast({
        title: 'Revise os dados informados',
        description: 'Preencha o nome e escolha uma idade entre 18 e 100 anos, altura entre 100 e 250 cm e peso entre 30 e 400 kg.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userData = validated.data;
      const mealPlan = await gerarPlanoIA(userData);
      setPlanResult(userData, mealPlan);

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
            Suas medidas e restrições alimentares são enviadas ao provedor de IA para criar o plano;
            seu nome não é enviado ao provedor de IA.
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
                  maxLength={100}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="idade">Idade *</Label>
                  <Input
                    id="idade"
                    type="number"
                    min={18}
                    max={100}
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
                  min={100}
                  max={250}
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
                  min={30}
                  max={400}
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
                  maxLength={500}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="preferencias">Preferências Alimentares</Label>
                <Textarea
                  id="preferencias"
                  placeholder="Ex: Vegetariano, vegano, low carb..."
                  value={formData.preferencias}
                  onChange={(e) => handleInputChange('preferencias', e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="naoGosta">Alimentos que não gosta</Label>
                <Textarea
                  id="naoGosta"
                  placeholder="Ex: Brócolis, fígado, beterraba..."
                  value={formData.alimentosNaoGosta}
                  onChange={(e) => handleInputChange('alimentosNaoGosta', e.target.value)}
                  maxLength={500}
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
