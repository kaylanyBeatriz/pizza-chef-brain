<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngredientProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingredient_pizza_and_recipe_crud(): void
    {
        $ingredientId = $this->postJson('/api/ingredients', [
            'name' => 'Farinha', 'unit' => 'kg', 'current_stock' => 25,
            'minimum_stock' => 5, 'unit_cost' => 8.5, 'supplier' => 'Moinho Central',
        ])->assertSuccessful()->json('data.id');

        $pizzaId = $this->postJson('/api/pizzas', [
            'name' => 'Pizza Margherita', 'description' => 'Molho, queijo e manjericão',
            'category' => 'Pizza', 'price' => 48, 'is_active' => true,
        ])->assertSuccessful()->json('data.id');

        $this->postJson("/api/pizzas/{$pizzaId}/recipe", [
            'ingredient_id' => $ingredientId, 'quantity' => 0.3,
        ])->assertSuccessful()->assertJsonPath('data.ingredient.name', 'Farinha');

        $this->getJson("/api/pizzas/{$pizzaId}")->assertOk()->assertJsonCount(1, 'data.recipe');
        $this->deleteJson("/api/ingredients/{$ingredientId}")->assertStatus(422);
    }
}
