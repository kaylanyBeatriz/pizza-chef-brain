<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Order;
use App\Models\Pizza;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStockApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_completing_an_order_deducts_stock_once(): void
    {
        [$ingredient, $pizza] = $this->createRecipe(10, 1.5);
        $orderId = $this->postJson('/api/orders', [
            'customer_name' => 'Bruna', 'order_type' => 'pickup',
            'items' => [['pizza_id' => $pizza->id, 'quantity' => 2]],
        ])->assertSuccessful()->assertJsonPath('data.total', 100)->json('data.id');

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_PREPARING])
            ->assertSuccessful()->assertJsonPath('data.status', Order::STATUS_PREPARING);
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_COMPLETED])
            ->assertSuccessful()->assertJsonPath('data.stock_deducted', true);
        $this->assertEquals(7.0, (float) $ingredient->refresh()->current_stock);
        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('revenueToday', 100);
        $this->getJson('/api/reports/consumption')
            ->assertOk()
            ->assertJsonPath('topConsumo.0.qty', 3);
        $this->getJson('/api/reports/finance')
            ->assertOk()
            ->assertJsonPath('revenueMonth', 100);

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_COMPLETED])->assertSuccessful();
        $this->assertEquals(7.0, (float) $ingredient->refresh()->current_stock);
    }

    public function test_insufficient_stock_rolls_back_order_completion(): void
    {
        [$ingredient, $pizza] = $this->createRecipe(1, 2);
        $orderId = $this->postJson('/api/orders', [
            'order_type' => 'pickup', 'items' => [['pizza_id' => $pizza->id, 'quantity' => 1]],
        ])->json('data.id');
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_PREPARING])->assertSuccessful();
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_COMPLETED])
            ->assertStatus(422)->assertJsonPath('message', 'Estoque insuficiente para Muçarela.');
        $this->assertEquals(1.0, (float) $ingredient->refresh()->current_stock);
        $this->assertDatabaseHas('orders', ['id' => $orderId, 'status' => Order::STATUS_PREPARING, 'stock_deducted' => false]);
    }

    public function test_pizza_without_recipe_cannot_complete(): void
    {
        $pizza = Pizza::query()->create(['name' => 'Pizza sem receita', 'category' => 'Pizza', 'price' => 30, 'is_active' => true]);
        $orderId = $this->postJson('/api/orders', [
            'order_type' => 'pickup', 'items' => [['pizza_id' => $pizza->id, 'quantity' => 1]],
        ])->json('data.id');
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_PREPARING])->assertSuccessful();
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => Order::STATUS_COMPLETED])->assertStatus(422);
    }

    public function test_dashboard_and_reports_return_frontend_contracts(): void
    {
        $this->getJson('/api/dashboard')->assertOk()->assertJsonStructure([
            'ordersToday', 'revenueToday', 'ordersMonth', 'revenueMonth', 'lowStock', 'topPizzas', 'monthly',
        ]);
        $this->getJson('/api/reports/consumption')->assertOk()->assertJsonStructure(['topConsumo', 'peakHours', 'forecast']);
        $this->getJson('/api/reports/finance')->assertOk()->assertJsonStructure([
            'revenueMonth', 'revenuePrev', 'ticket', 'estoqueAtivo', 'daily',
        ]);
    }

    /** @return array{Ingredient, Pizza} */
    private function createRecipe(float $stock, float $recipeQuantity): array
    {
        $ingredient = Ingredient::query()->create([
            'name' => 'Muçarela', 'unit' => 'kg', 'current_stock' => $stock,
            'minimum_stock' => 2, 'unit_cost' => 30,
        ]);
        $pizza = Pizza::query()->create([
            'name' => 'Pizza de Muçarela', 'category' => 'Pizza', 'price' => 50, 'is_active' => true,
        ]);
        $pizza->recipeItems()->create(['ingredient_id' => $ingredient->id, 'quantity' => $recipeQuantity]);

        return [$ingredient, $pizza];
    }
}
