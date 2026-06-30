<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngredientProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingredient_product_and_recipe_crud(): void
    {
        $ingredientId = $this->postJson('/api/ingredients', [
            'name' => 'Farinha',
            'unit' => 'kg',
            'stock_quantity' => 25,
            'min_stock' => 5,
            'cost_per_unit' => 8.5,
            'supplier' => 'Moinho Central',
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.status', 'ok')
            ->json('data.id');

        $productId = $this->postJson('/api/products', [
            'name' => 'Pizza Margherita',
            'description' => 'Molho, queijo e manjericão',
            'category' => 'Pizza',
            'price' => 48,
            'is_active' => true,
        ])
            ->assertSuccessful()
            ->json('data.id');

        $this->postJson("/api/products/{$productId}/recipe", [
            'ingredient_id' => $ingredientId,
            'quantity' => 0.3,
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.ingredient.name', 'Farinha');

        $this->getJson("/api/products/{$productId}")
            ->assertOk()
            ->assertJsonCount(1, 'data.recipe');

        $this->deleteJson("/api/ingredients/{$ingredientId}")
            ->assertStatus(422);
    }
}
