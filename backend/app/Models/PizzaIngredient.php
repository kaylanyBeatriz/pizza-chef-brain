<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['pizza_id', 'ingredient_id', 'quantity'])]
class PizzaIngredient extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }

    public function pizza(): BelongsTo
    {
        return $this->belongsTo(Pizza::class);
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
