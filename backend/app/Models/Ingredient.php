<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'unit', 'stock_quantity', 'min_stock', 'cost_per_unit', 'supplier'])]
class Ingredient extends Model
{
    use UsesUuid;

    protected function casts(): array
    {
        return [
            'stock_quantity' => 'decimal:3',
            'min_stock' => 'decimal:3',
            'cost_per_unit' => 'decimal:2',
        ];
    }

    public function recipeItems(): HasMany
    {
        return $this->hasMany(ProductIngredient::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
