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
  setUserData: (data: UserData) => void;
  mealPlan: MealPlan | null;
  setMealPlan: (plan: MealPlan) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  clearData: () => void;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export const NutritionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearData = () => {
    setUserData(null);
    setMealPlan(null);
  };

  return (
    <NutritionContext.Provider 
      value={{ 
        userData, 
        setUserData, 
        mealPlan, 
        setMealPlan, 
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
