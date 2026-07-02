<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'unit' => $this->unit,
            'current_stock' => (float) $this->current_stock,
            'minimum_stock' => (float) $this->minimum_stock,
            'unit_cost' => (float) $this->unit_cost,
            'supplier' => $this->supplier,
            'created_at' => $this->formatDate($this->created_at),
            'updated_at' => $this->formatDate($this->updated_at),
        ];
    }

    protected function formatDate($value): ?string
    {
        return $value?->copy()->timezone('America/Sao_Paulo')->format('Y-m-d\TH:i:sP');
    }
}
