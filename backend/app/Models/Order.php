<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'order_number', 'status', 'customer_name', 'customer_phone', 'order_type',
    'delivery_address', 'delivery_fee', 'subtotal', 'total', 'notes', 'created_by',
    'started_at', 'completed_at', 'cancelled_at', 'stock_deducted',
])]
class Order extends Model
{
    use UsesUuid;

    public const STATUS_PENDING = 'pendente';

    public const STATUS_PREPARING = 'preparando';

    public const STATUS_COMPLETED = 'concluido';

    public const STATUS_CANCELLED = 'cancelado';

    protected function casts(): array
    {
        return [
            'delivery_fee' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'total' => 'decimal:2',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'stock_deducted' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
