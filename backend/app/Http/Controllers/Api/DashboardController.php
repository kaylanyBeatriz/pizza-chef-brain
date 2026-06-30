<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\StockMovement;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $today = CarbonImmutable::today();
        $monthStart = $today->startOfMonth();
        $validOrders = Order::query()->where('status', '!=', Order::STATUS_CANCELLED);
        $completedOrders = Order::query()->where('status', Order::STATUS_COMPLETED);

        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.status', Order::STATUS_COMPLETED)
            ->where('orders.completed_at', '>=', $monthStart)
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->limit(5)
            ->get([
                'products.id',
                'products.name',
                DB::raw('SUM(order_items.quantity) as quantity'),
            ]);

        return response()->json([
            'orders_today' => (clone $validOrders)->whereDate('created_at', $today)->count(),
            'revenue_today' => (float) (clone $completedOrders)
                ->whereDate('completed_at', $today)
                ->sum('total'),
            'revenue_month' => (float) (clone $completedOrders)
                ->where('completed_at', '>=', $monthStart)
                ->sum('total'),
            'open_orders' => Order::query()
                ->whereIn('status', [Order::STATUS_PENDING, Order::STATUS_PREPARING])
                ->count(),
            'low_stock_count' => Ingredient::query()
                ->whereColumn('stock_quantity', '<=', 'min_stock')
                ->count(),
            'top_products' => $topProducts->map(fn ($product) => [
                'id' => $product->id,
                'name' => $product->name,
                'quantity' => (int) $product->quantity,
            ]),
        ]);
    }

    public function consumption(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $from = CarbonImmutable::parse($validated['from'] ?? CarbonImmutable::today()->subDays(29));
        $to = CarbonImmutable::parse($validated['to'] ?? CarbonImmutable::today());

        $items = DB::table('stock_movements')
            ->join('ingredients', 'ingredients.id', '=', 'stock_movements.ingredient_id')
            ->where('stock_movements.type', StockMovement::TYPE_ORDER_CONSUMPTION)
            ->whereBetween('stock_movements.created_at', [$from->startOfDay(), $to->endOfDay()])
            ->groupBy('ingredients.id', 'ingredients.name', 'ingredients.unit')
            ->orderByDesc(DB::raw('SUM(stock_movements.quantity)'))
            ->get([
                'ingredients.id',
                'ingredients.name',
                'ingredients.unit',
                DB::raw('SUM(stock_movements.quantity) as quantity'),
            ])
            ->map(fn ($item) => [
                'ingredient_id' => $item->id,
                'name' => $item->name,
                'unit' => $item->unit,
                'quantity' => round((float) $item->quantity, 3),
            ]);

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'items' => $items,
        ]);
    }

    public function finance(): JsonResponse
    {
        $now = CarbonImmutable::now();
        $monthStart = $now->startOfMonth();
        $previousMonthStart = $monthStart->subMonth();
        $completed = Order::query()->where('status', Order::STATUS_COMPLETED);

        $currentRevenue = (float) (clone $completed)
            ->whereBetween('completed_at', [$monthStart, $now])
            ->sum('total');
        $previousRevenue = (float) (clone $completed)
            ->whereBetween('completed_at', [$previousMonthStart, $monthStart])
            ->sum('total');
        $completedCount = (clone $completed)
            ->whereBetween('completed_at', [$monthStart, $now])
            ->count();

        $stockValue = Ingredient::query()
            ->selectRaw('COALESCE(SUM(stock_quantity * cost_per_unit), 0) as total')
            ->value('total');

        return response()->json([
            'revenue_month' => $currentRevenue,
            'revenue_previous_month' => $previousRevenue,
            'revenue_change_percent' => $previousRevenue > 0
                ? round((($currentRevenue - $previousRevenue) / $previousRevenue) * 100, 2)
                : null,
            'completed_orders_month' => $completedCount,
            'average_ticket_month' => $completedCount > 0
                ? round($currentRevenue / $completedCount, 2)
                : 0.0,
            'stock_value' => round((float) $stockValue, 2),
        ]);
    }
}
