import { materialById } from './catalog.ts';
import type { RecipeRoute } from './catalog.ts';
import { unitPrice } from './prices.ts';
import type { PriceSnapshot } from './prices.ts';

export function evaluateRecipe(recipe: RecipeRoute, snapshot: PriceSnapshot, commonPriceSide: 'buy' | 'sell' = 'sell') {
  const ingredients = recipe.ingredients.map(i => ({
    ...i, value: i.quantity * unitPrice(snapshot, i.material, materialById[i.material].group === 'common' ? commonPriceSide : 'sell'),
  }));
  const ingredientValue = ingredients.reduce((sum, i) => sum + i.value, 0);
  const salePrice = unitPrice(snapshot, recipe.output, 'sell');
  return { ...recipe, ingredients, ingredientValue, salePrice, benefit: salePrice - recipe.fee - ingredientValue };
}
