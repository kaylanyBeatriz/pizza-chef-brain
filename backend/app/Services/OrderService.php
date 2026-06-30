<?php

namespace App\Services;

use App\Exceptions\DomainException;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class OrderService
{
    public function __construct(private readonly StockService $stockService) {}

    public function create(array $payload): Order
    {
        return DB::transaction(function () use ($payload): Order {
            $productIds = collect($payload['items'])->pluck('product_id')->all();
            $products = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');

            $subtotal = collect($payload['items'])->sum(function (array $item) use ($products): float {
                $product = $products->get($item['product_id']);

                if (! $product || ! $product->is_active) {
                    throw new DomainException('Produto indisponível para pedido.');
                }

                return (float) $product->price * (int) $item['quantity'];
            });

            $deliveryFee = ($payload['order_type'] ?? 'pickup') === 'delivery'
                ? (float) ($payload['delivery_fee'] ?? 0)
                : 0.0;

            $order = Order::query()->create([
                'order_number' => $this->nextOrderNumber(),
                'status' => Order::STATUS_PENDING,
                'customer_name' => $payload['customer_name'] ?? null,
                'customer_phone' => $payload['customer_phone'] ?? null,
                'order_type' => $payload['order_type'] ?? 'pickup',
                'delivery_address' => $payload['delivery_address'] ?? null,
                'delivery_fee' => $deliveryFee,
                'subtotal' => $subtotal,
                'total' => $subtotal + $deliveryFee,
                'notes' => $payload['notes'] ?? null,
                'created_by' => $payload['created_by'] ?? null,
            ]);

            foreach ($payload['items'] as $item) {
                $product = $products->get($item['product_id']);
                $quantity = (int) $item['quantity'];

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $product->price,
                    'subtotal' => (float) $product->price * $quantity,
                ]);
            }

            return $order->load('items.product');
        });
    }

    public function updateStatus(Order $order, string $status): Order
    {
        return DB::transaction(function () use ($order, $status): Order {
            if ($order->status === $status) {
                return $order->load('items.product');
            }

            $this->assertValidTransition($order->status, $status);
            $updates = ['status' => $status];

            if ($status === Order::STATUS_PREPARING && ! $order->started_at) {
                $updates['started_at'] = now();
            }

            if ($status === Order::STATUS_CANCELLED && ! $order->cancelled_at) {
                $updates['cancelled_at'] = now();
            }

            if ($status === Order::STATUS_COMPLETED) {
                $this->stockService->deductForOrder($order);
                $updates['completed_at'] = now();
            }

            $order->fill($updates)->save();

            return $order->refresh()->load('items.product');
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

    private function nextOrderNumber(): int
    {
        $lastNumber = Order::query()->lockForUpdate()->max('order_number');

        return max(1000, ((int) $lastNumber) + 1);
    }
}
