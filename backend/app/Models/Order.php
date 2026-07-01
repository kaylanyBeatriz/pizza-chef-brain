<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'status', 'customer_name', 'customer_phone', 'order_type', 'delivery_address',
    'subtotal_amount', 'delivery_fee', 'total_amount', 'notes', 'preparing_at',
    'completed_at', 'cancelled_at', 'stock_deducted', 'stock_deducted_at',
])]
class Order extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PREPARING = 'preparing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected function casts(): array
    {
        return [
            'subtotal_amount' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'preparing_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'stock_deducted' => 'boolean',
            'stock_deducted_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
