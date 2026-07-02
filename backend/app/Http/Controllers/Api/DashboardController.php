<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $now = CarbonImmutable::now();
        $today = $now->startOfDay();
        $monthStart = $now->startOfMonth();

        $from = isset($validated['from'])
            ? CarbonImmutable::parse($validated['from'])->startOfDay()
            : $monthStart;
        $to = isset($validated['to'])
            ? CarbonImmutable::parse($validated['to'])->endOfDay()
            : $now->endOfDay();

        $completed = Order::query()->where('status', Order::STATUS_COMPLETED);
        $periodOrders = (clone $completed)
            ->whereBetween('completed_at', [$from, $to])
            ->get(['completed_at', 'total_amount']);

        $daily = $this->buildDailySeries($from, $to, $periodOrders);
        $topPizzas = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', Order::STATUS_COMPLETED)
            ->whereBetween('orders.completed_at', [$from, $to])
            ->groupBy('order_items.pizza_id', 'order_items.pizza_name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->limit(5)
            ->get([
                'order_items.pizza_name as name',
                DB::raw('SUM(order_items.quantity) as quantidade'),
            ])
            ->map(fn ($item) => ['name' => $item->name, 'quantidade' => (int) $item->quantidade]);

        return response()->json([
            'ordersToday' => Order::query()->whereDate('created_at', $today)->where('status', '!=', Order::STATUS_CANCELLED)->count(),
            'revenueToday' => (float) (clone $completed)->whereDate('completed_at', $today)->sum('total_amount'),
            'ordersPeriod' => $periodOrders->count(),
            'revenuePeriod' => round((float) $periodOrders->sum(fn (Order $order) => (float) $order->total_amount), 2),
            'lowStock' => Ingredient::query()->whereColumn('current_stock', '<=', 'minimum_stock')->orderBy('current_stock')->get([
                'id', 'name', 'current_stock', 'minimum_stock', 'unit',
            ]),
            'topPizzas' => $topPizzas,
            'daily' => $daily,
        ]);
    }

    public function consumption(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $from = CarbonImmutable::parse($validated['from'] ?? CarbonImmutable::today()->subDays(29))->startOfDay();
        $to = CarbonImmutable::parse($validated['to'] ?? CarbonImmutable::today())->endOfDay();
        $days = max(1, $from->diffInDays($to) + 1);

        $consumption = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('pizza_ingredients', 'pizza_ingredients.pizza_id', '=', 'order_items.pizza_id')
            ->where('orders.status', Order::STATUS_COMPLETED)
            ->whereBetween('orders.completed_at', [$from, $to])
            ->groupBy('pizza_ingredients.ingredient_id')
            ->get([
                'pizza_ingredients.ingredient_id',
                DB::raw('SUM(order_items.quantity * pizza_ingredients.quantity) as required_quantity'),
            ])
            ->pluck('required_quantity', 'ingredient_id');

        $ingredients = Ingredient::query()->orderBy('name')->get();
        $top = $ingredients->map(function (Ingredient $ingredient) use ($consumption): array {
            return [
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'qty' => (float) ($consumption[$ingredient->id] ?? 0),
                'stock' => (float) $ingredient->current_stock,
                'min' => (float) $ingredient->minimum_stock,
            ];
        })->filter(fn (array $item) => $item['qty'] > 0)->sortByDesc('qty')->take(8)->values();

        $peak = array_fill(0, 24, 0);
        Order::query()->whereBetween('created_at', [$from, $to])->where('status', '!=', Order::STATUS_CANCELLED)
            ->get(['created_at'])->each(function (Order $order) use (&$peak): void {
                $peak[$order->created_at->hour]++;
            });
        $peakHours = collect($peak)->map(fn (int $count, int $hour) => [
            'hora' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).'h',
            'pedidos' => $count,
        ])->filter(fn (array $item) => $item['pedidos'] > 0)->values();

        $forecast = $ingredients->map(function (Ingredient $ingredient) use ($consumption, $days): array {
            $average = (float) ($consumption[$ingredient->id] ?? 0) / $days;
            $stock = (float) $ingredient->current_stock;
            $minimum = (float) $ingredient->minimum_stock;
            $status = null;
            $priority = 2;

            if ($stock <= $minimum * 0.5) {
                $status = 'critical';
                $priority = 0;
            } elseif ($stock <= $minimum) {
                $status = 'low';
                $priority = 1;
            }

            return [
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'stock' => $stock,
                'avgDay' => $average,
                'diasRest' => $average > 0 ? $stock / $average : null,
                'min' => $minimum,
                'status' => $status,
                'priority' => $priority,
            ];
        })->filter(fn (array $item) => $item['status'] !== null || ($item['avgDay'] > 0 && $item['diasRest'] < 14))
            ->sort(function (array $a, array $b): int {
                return [$a['priority'], $a['diasRest'], $a['name']] <=> [$b['priority'], $b['diasRest'], $b['name']];
            })
            ->take(6)->values();

        return response()->json(['topConsumo' => $top, 'peakHours' => $peakHours, 'forecast' => $forecast]);
    }

    public function finance(): JsonResponse
    {
        $now = CarbonImmutable::now();
        $monthStart = $now->startOfMonth();
        $previousMonthStart = $monthStart->subMonth();
        $thirtyDays = $now->subDays(29)->startOfDay();
        $completed = Order::query()->where('status', Order::STATUS_COMPLETED);

        $current = (float) (clone $completed)->whereBetween('completed_at', [$monthStart, $now])->sum('total_amount');
        $previous = (float) (clone $completed)->whereBetween('completed_at', [$previousMonthStart, $monthStart])->sum('total_amount');
        $count = (clone $completed)->whereBetween('completed_at', [$monthStart, $now])->count();
        $dailyOrders = (clone $completed)->whereBetween('completed_at', [$thirtyDays, $now])->get(['completed_at', 'total_amount']);
        $daily = collect(range(29, 1))->map(function (int $daysAgo) use ($now, $dailyOrders): array {
            $day = $now->subDays($daysAgo);

            return [
                'dia' => $day->format('d/m'),
                'receita' => (float) $dailyOrders
                    ->filter(fn (Order $order) => $order->completed_at?->toDateString() === $day->toDateString())
                    ->sum(fn (Order $order) => (float) $order->total_amount),
            ];
        })->push([
            'dia' => $now->format('d/m'),
            'receita' => (float) $dailyOrders
                ->filter(fn (Order $order) => $order->completed_at?->toDateString() === $now->toDateString())
                ->sum(fn (Order $order) => (float) $order->total_amount),
        ]);

        return response()->json([
            'revenueMonth' => $current,
            'revenuePrev' => $previous,
            'ticket' => $count > 0 ? round($current / $count, 2) : 0,
            'estoqueAtivo' => (float) Ingredient::query()->selectRaw('COALESCE(SUM(current_stock * unit_cost), 0) as total')->value('total'),
            'daily' => $daily->values(),
        ]);
    }

    /**
     * @param  iterable<int, Order>  $orders
     * @return array<int, array{dia: string, vendas: float}>
     */
    private function buildDailySeries(CarbonImmutable $from, CarbonImmutable $to, iterable $orders): array
    {
        $ordersByDay = collect($orders)->groupBy(fn (Order $order) => $order->completed_at?->toDateString());
        $series = [];
        $current = $from->startOfDay();
        $end = $to->startOfDay();

        while ($current->lessThanOrEqualTo($end)) {
            $dayOrders = $ordersByDay->get($current->toDateString(), collect());
            $series[] = [
                'dia' => $current->format('d/m'),
                'vendas' => round((float) $dayOrders->sum(fn (Order $order) => (float) $order->total_amount), 2),
            ];
            $current = $current->addDay();
        }

        return $series;
    }
}
