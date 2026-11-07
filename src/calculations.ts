import type { RecipeRoute } from './catalog.ts';
import { unitPrice } from './prices.ts';
import type { PriceSnapshot } from './prices.ts';

export function evaluateRecipe(recipe: RecipeRoute, snapshot: PriceSnapshot) {
  const ingredients = recipe.ingredients.map(i => ({
    ...i, saleValue: i.quantity * unitPrice(snapshot, i.material, 'sell'),
  }));
  const ingredientValue = ingredients.reduce((sum, i) => sum + i.saleValue, 0);
  const salePrice = unitPrice(snapshot, recipe.output, 'sell');
  return { ...recipe, ingredients, ingredientValue, salePrice, benefit: salePrice - recipe.fee - ingredientValue };
}
