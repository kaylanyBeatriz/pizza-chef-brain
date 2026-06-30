<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStockApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_completing_an_order_deducts_stock_once_and_records_movements(): void
    {
        [$ingredient, $product] = $this->createRecipe(stock: 10, recipeQuantity: 1.5);

        $orderId = $this->postJson('/api/orders', [
            'customer_name' => 'Bruna',
            'order_type' => 'pickup',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.order_number', 1000)
            ->assertJsonPath('data.total', 100)
            ->json('data.id');

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_PREPARING,
        ])->assertSuccessful();

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_COMPLETED,
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.stock_deducted', true);

        $this->assertEquals(7.0, (float) $ingredient->refresh()->stock_quantity);
        $this->assertDatabaseHas('stock_movements', [
            'ingredient_id' => $ingredient->id,
            'order_id' => $orderId,
            'type' => StockMovement::TYPE_ORDER_CONSUMPTION,
            'quantity' => 3,
        ]);

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_COMPLETED,
        ])->assertSuccessful();

        $this->assertEquals(7.0, (float) $ingredient->refresh()->stock_quantity);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_insufficient_stock_rolls_back_order_completion(): void
    {
        [$ingredient, $product] = $this->createRecipe(stock: 1, recipeQuantity: 2);

        $orderId = $this->postJson('/api/orders', [
            'order_type' => 'pickup',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ])->json('data.id');

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_PREPARING,
        ])->assertSuccessful();

        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => Order::STATUS_COMPLETED,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Estoque insuficiente para Muçarela.');

        $this->assertEquals(1.0, (float) $ingredient->refresh()->stock_quantity);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => Order::STATUS_PREPARING,
            'stock_deducted' => false,
        ]);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_manual_stock_entries_and_exits_are_audited(): void
    {
        [$ingredient] = $this->createRecipe(stock: 5, recipeQuantity: 1);

        $this->postJson("/api/ingredients/{$ingredient->id}/movements", [
            'type' => StockMovement::TYPE_ENTRY,
            'quantity' => 2.5,
            'notes' => 'Compra semanal',
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.stock_before', 5)
            ->assertJsonPath('data.stock_after', 7.5);

        $this->postJson("/api/ingredients/{$ingredient->id}/movements", [
            'type' => StockMovement::TYPE_EXIT,
            'quantity' => 1,
        ])
            ->assertSuccessful()
            ->assertJsonPath('data.stock_after', 6.5);

        $this->assertEquals(6.5, (float) $ingredient->refresh()->stock_quantity);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_dashboard_and_reports_return_aggregate_shapes(): void
    {
        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'orders_today', 'revenue_today', 'revenue_month', 'open_orders',
                'low_stock_count', 'top_products',
            ]);

        $this->getJson('/api/reports/consumption')
            ->assertOk()
            ->assertJsonStructure(['from', 'to', 'items']);

        $this->getJson('/api/reports/finance')
            ->assertOk()
            ->assertJsonStructure([
                'revenue_month', 'revenue_previous_month', 'revenue_change_percent',
                'completed_orders_month', 'average_ticket_month', 'stock_value',
            ]);
    }

    /** @return array{Ingredient, Product} */
    private function createRecipe(float $stock, float $recipeQuantity): array
    {
        $ingredient = Ingredient::query()->create([
            'name' => 'Muçarela',
            'unit' => 'kg',
            'stock_quantity' => $stock,
            'min_stock' => 2,
            'cost_per_unit' => 30,
        ]);
        $product = Product::query()->create([
            'name' => 'Pizza de Muçarela',
            'category' => 'Pizza',
            'price' => 50,
            'is_active' => true,
        ]);
        $product->recipeItems()->create([
            'ingredient_id' => $ingredient->id,
            'quantity' => $recipeQuantity,
        ]);

        return [$ingredient, $product];
    }
}
