<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['type', 'description', 'category', 'amount', 'payment_method', 'counterparty', 'due_date', 'paid_at', 'notes'])]
class Transaction extends Model
{
    public const TYPE_INCOME = 'income';
    public const TYPE_EXPENSE = 'expense';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'due_date' => 'date:Y-m-d',
            'paid_at' => 'date:Y-m-d',
        ];
    }

    public function status(): string
    {
        if ($this->paid_at !== null) {
            return 'paid';
        }

        return $this->due_date->toDateString() < CarbonImmutable::today('America/Sao_Paulo')->toDateString()
            ? 'overdue'
            : 'pending';
    }
}
