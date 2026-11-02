<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'description' => $this->description,
            'category' => $this->category,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'counterparty' => $this->counterparty,
            'due_date' => $this->due_date?->format('Y-m-d'),
            'paid_at' => $this->paid_at?->format('Y-m-d'),
            'status' => $this->status(),
            'notes' => $this->notes,
        ];
    }
}
