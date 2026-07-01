<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'pizza_id' => $this->pizza_id,
            'pizza_name' => $this->pizza_name,
            'quantity' => (int) $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'total_price' => (float) $this->total_price,
            'product' => $this->relationLoaded('pizza') && $this->pizza
                ? ['name' => $this->pizza->name]
                : ['name' => $this->pizza_name],
        ];
    }
}
