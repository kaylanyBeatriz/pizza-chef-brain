<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $stock = (float) $this->stock_quantity;
        $min = (float) $this->min_stock;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'unit' => $this->unit,
            'stock_quantity' => $stock,
            'min_stock' => $min,
            'cost_per_unit' => (float) $this->cost_per_unit,
            'supplier' => $this->supplier,
            'status' => $stock <= $min * 0.5 ? 'critical' : ($stock <= $min ? 'low' : 'ok'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
