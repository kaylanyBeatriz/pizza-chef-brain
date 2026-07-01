<?php

namespace App\Services;

use App\Exceptions\DomainException;
use App\Models\Ingredient;
use App\Models\Order;
use Illuminate\Support\Collection;

class StockService
{
    /** @return Collection<int, float> */
    public function requiredIngredientsForOrder(Order $order): Collection
    {
        $order->loadMissing('items.pizza.recipeItems');
        $required = collect();

        foreach ($order->items as $item) {
            if (! $item->pizza || $item->pizza->recipeItems->isEmpty()) {
                throw new DomainException("A pizza {$item->pizza_name} não possui receita cadastrada.");
            }

            foreach ($item->pizza->recipeItems as $recipeItem) {
                $ingredientId = (int) $recipeItem->ingredient_id;
                $quantity = (float) $recipeItem->quantity * (int) $item->quantity;
                $required[$ingredientId] = ((float) ($required[$ingredientId] ?? 0)) + $quantity;
            }
        }

        return $required;
    }

    public function deductForOrder(Order $order): void
    {
        if ($order->stock_deducted) {
            return;
        }

        $required = $this->requiredIngredientsForOrder($order);
        $ingredients = Ingredient::query()
            ->whereIn('id', $required->keys()->sort()->values())
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        foreach ($required as $ingredientId => $quantity) {
            $ingredient = $ingredients->get($ingredientId);

            if (! $ingredient) {
                throw new DomainException('Ingrediente da receita não encontrado.');
            }

            if ((float) $ingredient->current_stock < $quantity) {
                throw new DomainException("Estoque insuficiente para {$ingredient->name}.");
            }
        }

        foreach ($required as $ingredientId => $quantity) {
            $ingredient = $ingredients->get($ingredientId);
            $ingredient->update([
                'current_stock' => round((float) $ingredient->current_stock - $quantity, 3),
            ]);
        }
    }
}
