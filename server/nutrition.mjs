// Compatibility exports for integrations that imported the original combined module.
export { ApiError } from './errors.mjs';
export { answerChat } from './chat-service.mjs';
export { calculateEnergy, DISCLAIMER, generateMealPlan } from './meal-plan-service.mjs';
export {
  chatRequestSchema,
  generatedPlanSchema,
  mealPlanRequestSchema,
  mealPlanSchema,
  profileSchema,
} from './schemas.mjs';
