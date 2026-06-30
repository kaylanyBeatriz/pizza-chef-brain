<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductIngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'ingredient_id' => $this->ingredient_id,
            'quantity' => (float) $this->quantity,
            'ingredient' => new IngredientResource($this->whenLoaded('ingredient')),
        ];
    }
}
