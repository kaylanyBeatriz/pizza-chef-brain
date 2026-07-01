<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'unit', 'current_stock', 'minimum_stock', 'unit_cost', 'supplier'])]
class Ingredient extends Model
{
    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:3',
            'minimum_stock' => 'decimal:3',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function recipeItems(): HasMany
    {
        return $this->hasMany(PizzaIngredient::class);
    }
}
