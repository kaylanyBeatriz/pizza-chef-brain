<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'order_number' => (int) $this->id,
            'status' => $this->status,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'order_type' => $this->order_type,
            'delivery_address' => $this->delivery_address,
            'subtotal_amount' => (float) $this->subtotal_amount,
            'delivery_fee' => (float) $this->delivery_fee,
            'total' => (float) $this->total_amount,
            'notes' => $this->notes,
            'started_at' => $this->formatDate($this->preparing_at),
            'completed_at' => $this->formatDate($this->completed_at),
            'cancelled_at' => $this->formatDate($this->cancelled_at),
            'stock_deducted' => (bool) $this->stock_deducted,
            'stock_deducted_at' => $this->formatDate($this->stock_deducted_at),
            'created_at' => $this->formatDate($this->created_at),
            'updated_at' => $this->formatDate($this->updated_at),
            'order_items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }

    protected function formatDate($value): ?string
    {
        return $value?->copy()->timezone('America/Sao_Paulo')->format('Y-m-d\TH:i:sP');
    }
}
