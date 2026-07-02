<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Order;
use App\Models\Pizza;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
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
            'ordersToday', 'revenueToday', 'ordersPeriod', 'revenuePeriod', 'lowStock', 'topPizzas', 'daily',
        ]);
        $this->getJson('/api/reports/consumption')->assertOk()->assertJsonStructure(['topConsumo', 'peakHours', 'forecast']);
        $this->getJson('/api/reports/finance')->assertOk()->assertJsonStructure([
            'revenueMonth', 'revenuePrev', 'ticket', 'estoqueAtivo', 'daily',
        ]);
    }

    public function test_dashboard_honors_selected_date_range_without_changing_today_cards(): void
    {
        $pizza = Pizza::query()->create(['name' => 'Pizza de Calabresa', 'category' => 'Pizza', 'price' => 60, 'is_active' => true]);

        $today = CarbonImmutable::today();
        $periodOrderId = DB::table('orders')->insertGetId([
            'customer_name' => 'Hoje',
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'subtotal_amount' => 60,
            'delivery_fee' => 0,
            'total_amount' => 60,
            'stock_deducted' => true,
            'created_at' => $today->setTime(10, 0, 0),
            'preparing_at' => $today->setTime(9, 30, 0),
            'completed_at' => $today->setTime(10, 15, 0),
            'updated_at' => $today->setTime(10, 15, 0),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $periodOrderId,
            'pizza_id' => $pizza->id,
            'pizza_name' => 'Pizza de Calabresa',
            'quantity' => 1,
            'unit_price' => 60,
            'total_price' => 60,
        ]);

        $otherDay = $today->subDays(5);
        $otherOrderId = DB::table('orders')->insertGetId([
            'customer_name' => 'Outro dia',
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'subtotal_amount' => 120,
            'delivery_fee' => 0,
            'total_amount' => 120,
            'stock_deducted' => true,
            'created_at' => $otherDay->setTime(11, 0, 0),
            'preparing_at' => $otherDay->setTime(10, 30, 0),
            'completed_at' => $otherDay->setTime(11, 10, 0),
            'updated_at' => $otherDay->setTime(11, 10, 0),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $otherOrderId,
            'pizza_id' => $pizza->id,
            'pizza_name' => 'Pizza de Calabresa',
            'quantity' => 2,
            'unit_price' => 60,
            'total_price' => 120,
        ]);

        $response = $this->getJson('/api/dashboard?from=' . $otherDay->format('Y-m-d') . '&to=' . $today->format('Y-m-d'))->assertOk();
        $response->assertJsonPath('ordersToday', 1);
        $response->assertJsonPath('revenueToday', 60);
        $response->assertJsonPath('ordersPeriod', 2);
        $response->assertJsonPath('revenuePeriod', 180);
        $response->assertJsonPath('topPizzas.0.name', 'Pizza de Calabresa');
        $response->assertJsonPath('topPizzas.0.quantidade', 3);
        $response->assertJsonCount(6, 'daily');
    }


    public function test_dashboard_monetary_values_ignore_cancelled_orders(): void
    {
        $pizza = Pizza::query()->create(['name' => 'Pizza de Frango', 'category' => 'Pizza', 'price' => 40, 'is_active' => true]);

        $today = CarbonImmutable::today();
        $completedOrderId = DB::table('orders')->insertGetId([
            'customer_name' => 'Concluido',
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'subtotal_amount' => 80,
            'delivery_fee' => 0,
            'total_amount' => 80,
            'stock_deducted' => true,
            'created_at' => $today->setTime(9, 0, 0),
            'preparing_at' => $today->setTime(9, 10, 0),
            'completed_at' => $today->setTime(9, 20, 0),
            'updated_at' => $today->setTime(9, 20, 0),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $completedOrderId,
            'pizza_id' => $pizza->id,
            'pizza_name' => 'Pizza de Frango',
            'quantity' => 2,
            'unit_price' => 40,
            'total_price' => 80,
        ]);

        $cancelledOrderId = DB::table('orders')->insertGetId([
            'customer_name' => 'Cancelado',
            'order_type' => 'pickup',
            'status' => Order::STATUS_CANCELLED,
            'subtotal_amount' => 120,
            'delivery_fee' => 0,
            'total_amount' => 120,
            'stock_deducted' => false,
            'created_at' => $today->setTime(10, 0, 0),
            'cancelled_at' => $today->setTime(10, 15, 0),
            'updated_at' => $today->setTime(10, 15, 0),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $cancelledOrderId,
            'pizza_id' => $pizza->id,
            'pizza_name' => 'Pizza de Frango',
            'quantity' => 3,
            'unit_price' => 40,
            'total_price' => 120,
        ]);

        $response = $this->getJson('/api/dashboard?from=' . $today->format('Y-m-d') . '&to=' . $today->format('Y-m-d'))->assertOk();

        $response->assertJsonPath('ordersToday', 1);
        $response->assertJsonPath('ordersPeriod', 1);
        $response->assertJsonPath('revenueToday', 80);
        $response->assertJsonPath('revenuePeriod', 80);
        $response->assertJsonPath('daily.0.vendas', 80);
        $response->assertJsonPath('topPizzas.0.quantidade', 2);
    }

    public function test_consumption_forecast_includes_low_and_critical_stock_items(): void
    {
        Ingredient::query()->create([
            'name' => 'Tomate', 'unit' => 'kg', 'current_stock' => 1.5,
            'minimum_stock' => 2, 'unit_cost' => 5,
        ]);
        Ingredient::query()->create([
            'name' => 'Queijo', 'unit' => 'kg', 'current_stock' => 0.5,
            'minimum_stock' => 2, 'unit_cost' => 25,
        ]);

        $response = $this->getJson('/api/reports/consumption')->assertOk();
        $response->assertJsonCount(2, 'forecast');
        $response->assertJsonPath('forecast.0.name', 'Queijo');
        $response->assertJsonPath('forecast.0.status', 'critical');
        $response->assertJsonPath('forecast.1.name', 'Tomate');
        $response->assertJsonPath('forecast.1.status', 'low');
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
