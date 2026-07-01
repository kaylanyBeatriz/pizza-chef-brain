<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PizzaIngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'pizza_id' => (string) $this->pizza_id,
            'ingredient_id' => (string) $this->ingredient_id,
            'quantity' => (float) $this->quantity,
            'ingredient' => new IngredientResource($this->whenLoaded('ingredient')),
        ];
    }
}
