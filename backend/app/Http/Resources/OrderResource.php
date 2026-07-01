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
            'started_at' => $this->preparing_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'cancelled_at' => $this->cancelled_at?->toISOString(),
            'stock_deducted' => (bool) $this->stock_deducted,
            'stock_deducted_at' => $this->stock_deducted_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'order_items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
