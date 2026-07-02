<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PizzaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'price' => (float) $this->price,
            'is_active' => (bool) $this->is_active,
            'recipe' => PizzaIngredientResource::collection($this->whenLoaded('recipeItems')),
            'created_at' => $this->formatDate($this->created_at),
            'updated_at' => $this->formatDate($this->updated_at),
        ];
    }

    protected function formatDate($value): ?string
    {
        return $value?->copy()->timezone('America/Sao_Paulo')->format('Y-m-d\TH:i:sP');
    }
}
