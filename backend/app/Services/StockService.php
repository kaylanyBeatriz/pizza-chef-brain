<?php

namespace App\Services;

use App\Exceptions\DomainException;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\StockMovement;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StockService
{
    /** @return Collection<string, float> */
    public function requiredIngredientsForOrder(Order $order): Collection
    {
        $order->loadMissing('items.product.recipeItems');
        $required = collect();

        foreach ($order->items as $item) {
            foreach ($item->product->recipeItems as $recipeItem) {
                $ingredientId = $recipeItem->ingredient_id;
                $quantity = (float) $recipeItem->quantity * $item->quantity;
                $required[$ingredientId] = ((float) ($required[$ingredientId] ?? 0)) + $quantity;
            }
        }

        return $required;
    }

    public function adjust(Ingredient $ingredient, array $payload): StockMovement
    {
        return DB::transaction(function () use ($ingredient, $payload): StockMovement {
            $lockedIngredient = Ingredient::query()->lockForUpdate()->findOrFail($ingredient->id);
            $before = (float) $lockedIngredient->stock_quantity;
            $quantity = (float) $payload['quantity'];
            $after = $payload['type'] === StockMovement::TYPE_ENTRY
                ? $before + $quantity
                : $before - $quantity;

            if ($after < 0) {
                throw new DomainException("Estoque insuficiente para {$lockedIngredient->name}.");
            }

            $after = round($after, 3);
            $lockedIngredient->update(['stock_quantity' => $after]);

            return StockMovement::query()->create([
                'ingredient_id' => $lockedIngredient->id,
                'type' => $payload['type'],
                'quantity' => $quantity,
                'stock_before' => $before,
                'stock_after' => $after,
                'notes' => $payload['notes'] ?? null,
                'created_by' => $payload['created_by'] ?? null,
            ]);
        });
    }

    public function assertEnoughStock(Order $order): void
    {
        $required = $this->requiredIngredientsForOrder($order);
        $ingredients = $this->lockIngredients($required);

        $this->validateStock($required, $ingredients);
    }

    public function deductForOrder(Order $order): void
    {
        if ($order->stock_deducted) {
            return;
        }

        $required = $this->requiredIngredientsForOrder($order);
        $ingredients = $this->lockIngredients($required);
        $this->validateStock($required, $ingredients);

        foreach ($required as $ingredientId => $quantity) {
            $ingredient = $ingredients->get($ingredientId);
            $before = (float) $ingredient->stock_quantity;
            $after = round($before - $quantity, 3);

            $ingredient->update(['stock_quantity' => $after]);
            StockMovement::query()->create([
                'ingredient_id' => $ingredient->id,
                'order_id' => $order->id,
                'type' => StockMovement::TYPE_ORDER_CONSUMPTION,
                'quantity' => $quantity,
                'stock_before' => $before,
                'stock_after' => $after,
                'notes' => "Consumo do pedido #{$order->order_number}",
                'created_by' => $order->created_by,
            ]);
        }

        $order->forceFill(['stock_deducted' => true])->save();
    }

    /** @param Collection<string, float> $required */
    private function lockIngredients(Collection $required): Collection
    {
        return Ingredient::query()
            ->whereIn('id', $required->keys())
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /**
     * @param  Collection<string, float>  $required
     * @param  Collection<string, Ingredient>  $ingredients
     */
    private function validateStock(Collection $required, Collection $ingredients): void
    {
        foreach ($required as $ingredientId => $quantity) {
            $ingredient = $ingredients->get($ingredientId);

            if (! $ingredient) {
                throw new DomainException('Ingrediente da receita não encontrado.');
            }

            if ((float) $ingredient->stock_quantity < $quantity) {
                throw new DomainException("Estoque insuficiente para {$ingredient->name}.");
            }
        }
    }
}
