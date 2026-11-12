import materialData from './data/materials.json' with { type: 'json' };
import recipeData from './data/recipes.json' with { type: 'json' };

export interface Material {
  id: string;
  toolboxId: string;
  name: string;
  shortName?: string;
  group: 'common' | 'rare';
  lotSize: number;
}
export interface Ingredient { material: string; quantity: number }
export interface Recipe { output: string; fee: number; ingredients: Ingredient[] }
export const materials = materialData as Material[];
export const materialById = Object.fromEntries(materials.map(m => [m.id, m]));
export const recipes: Recipe[] = recipeData.recipes;
export const recipeSource = recipeData.source;

export interface RecipeRoute extends Recipe {
  id: string;
  via?: string;
}

// Expand one intermediate recipe in place, combining duplicate starting ingredients.
// This keeps chained fees derived from the same recipes as the primary rows.
export function routesFor(recipe: Recipe): RecipeRoute[] {
  const direct = { ...recipe, id: recipe.output };
  const routes: RecipeRoute[] = [direct];
  for (const ingredient of recipe.ingredients) {
    const intermediate = recipes.find(r => r.output === ingredient.material);
    if (!intermediate) continue;
    const combined = new Map<string, number>();
    const starting = recipe.ingredients.flatMap(i => i === ingredient
      ? intermediate.ingredients.map(input => ({ ...input, quantity: input.quantity * ingredient.quantity }))
      : [i]);
    for (const i of starting) combined.set(i.material, (combined.get(i.material) ?? 0) + i.quantity);
    routes.push({
      output: recipe.output,
      id: `${recipe.output}-via-${ingredient.material}`,
      via: ingredient.material,
      fee: recipe.fee + intermediate.fee * ingredient.quantity,
      ingredients: [...combined].map(([material, quantity]) => ({ material, quantity })),
    });
  }
  return routes;
}
