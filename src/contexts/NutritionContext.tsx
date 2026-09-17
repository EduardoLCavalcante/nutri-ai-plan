import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface UserData {
  nome: string;
  idade: number;
  sexo: 'masculino' | 'feminino';
  altura: number;
  peso: number;
  perfil: 'atleta' | 'nao_atleta';
  objetivo: 'emagrecimento' | 'hipertrofia' | 'manutencao' | 'saude';
  tempo: 30 | 60 | 90;
  refeicoes: number;
  restricoes: string;
  preferencias: string;
  alimentosNaoGosta: string;
}

export interface Alimento {
  nome: string;
  quantidade: string;
  calorias: number;
}

export interface Refeicao {
  nome: string;
  alimentos: Alimento[];
}

export interface MealPlan {
  calorias_diarias: number;
  macros: {
    proteinas: string;
    carboidratos: string;
    gorduras: string;
  };
  refeicoes: Refeicao[];
  aviso: string;
  tmb: number;
  get: number;
}

interface NutritionContextType {
  userData: UserData | null;
  mealPlan: MealPlan | null;
  setPlanResult: (data: UserData, plan: MealPlan) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  clearData: () => void;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export const NutritionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [planResult, setPlanResultState] = useState<{ userData: UserData; mealPlan: MealPlan } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setPlanResult = (userData: UserData, mealPlan: MealPlan) => {
    setPlanResultState({ userData, mealPlan });
  };

  const clearData = () => {
    setPlanResultState(null);
  };

  return (
    <NutritionContext.Provider 
      value={{ 
        userData: planResult?.userData ?? null,
        mealPlan: planResult?.mealPlan ?? null,
        setPlanResult,
        isLoading, 
        setIsLoading,
        clearData 
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (context === undefined) {
    throw new Error('useNutrition must be used within a NutritionProvider');
  }
  return context;
};
