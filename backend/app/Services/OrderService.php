<?php

namespace App\Services;

use App\Exceptions\DomainException;
use App\Models\Order;
use App\Models\Pizza;
use Illuminate\Support\Facades\DB;

class OrderService
{
    public function __construct(private readonly StockService $stockService) {}

    public function create(array $payload): Order
    {
        return DB::transaction(function () use ($payload): Order {
            $pizzaIds = collect($payload['items'])->pluck('pizza_id')->unique()->values();
            $pizzas = Pizza::query()->whereIn('id', $pizzaIds)->get()->keyBy('id');

            $subtotal = collect($payload['items'])->sum(function (array $item) use ($pizzas): float {
                $pizza = $pizzas->get($item['pizza_id']);

                if (! $pizza || ! $pizza->is_active) {
                    throw new DomainException('Pizza indisponível para pedido.');
                }

                return (float) $pizza->price * (int) $item['quantity'];
            });

            $deliveryFee = $payload['order_type'] === 'delivery'
                ? (float) ($payload['delivery_fee'] ?? 0)
                : 0.0;

            $order = Order::query()->create([
                'status' => Order::STATUS_PENDING,
                'customer_name' => $payload['customer_name'] ?? null,
                'customer_phone' => $payload['customer_phone'] ?? null,
                'order_type' => $payload['order_type'],
                'delivery_address' => $payload['order_type'] === 'delivery'
                    ? ($payload['delivery_address'] ?? null)
                    : null,
                'subtotal_amount' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total_amount' => $subtotal + $deliveryFee,
                'notes' => $payload['notes'] ?? null,
            ]);

            foreach ($payload['items'] as $item) {
                $pizza = $pizzas->get($item['pizza_id']);
                $quantity = (int) $item['quantity'];

                $order->items()->create([
                    'pizza_id' => $pizza->id,
                    'pizza_name' => $pizza->name,
                    'quantity' => $quantity,
                    'unit_price' => $pizza->price,
                    'total_price' => (float) $pizza->price * $quantity,
                ]);
            }

            return $order->load('items.pizza');
        });
    }

    public function updateStatus(Order $order, string $status): Order
    {
        return DB::transaction(function () use ($order, $status): Order {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($order->status === $status) {
                return $order->load('items.pizza');
            }

            $this->assertValidTransition($order->status, $status);
            $updates = ['status' => $status];

            if ($status === Order::STATUS_PENDING) {
                $updates += ['preparing_at' => null, 'completed_at' => null, 'cancelled_at' => null];
            }

            if ($status === Order::STATUS_PREPARING) {
                $updates += ['preparing_at' => now(), 'completed_at' => null, 'cancelled_at' => null];
            }

            if ($status === Order::STATUS_CANCELLED) {
                $updates += ['cancelled_at' => now(), 'completed_at' => null];
            }

            if ($status === Order::STATUS_COMPLETED) {
                $this->stockService->deductForOrder($order);
                $updates += [
                    'completed_at' => now(),
                    'cancelled_at' => null,
                    'stock_deducted' => true,
                    'stock_deducted_at' => now(),
                ];
            }

            $order->update($updates);

            return $order->refresh()->load('items.pizza');
        });
    }

    private function assertValidTransition(string $from, string $to): void
    {
        $allowed = [
            Order::STATUS_PENDING => [Order::STATUS_PREPARING, Order::STATUS_CANCELLED],
            Order::STATUS_PREPARING => [Order::STATUS_PENDING, Order::STATUS_COMPLETED, Order::STATUS_CANCELLED],
            Order::STATUS_COMPLETED => [],
            Order::STATUS_CANCELLED => [],
        ];

        if (! in_array($to, $allowed[$from] ?? [], true)) {
            throw new DomainException("Transição de status inválida: {$from} para {$to}.");
        }
    }
}
