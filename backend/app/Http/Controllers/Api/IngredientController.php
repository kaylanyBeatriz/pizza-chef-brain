<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Requests\IngredientRequest;
use App\Http\Requests\StockMovementRequest;
use App\Http\Resources\IngredientResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Ingredient;
use App\Services\StockService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class IngredientController extends Controller
{
    public function __construct(private readonly StockService $stockService) {}

    public function index(): AnonymousResourceCollection
    {
        return IngredientResource::collection(
            Ingredient::query()->orderBy('name')->paginate(50),
        );
    }

    public function store(IngredientRequest $request): IngredientResource
    {
        $ingredient = Ingredient::query()->create($request->validated());

        return new IngredientResource($ingredient);
    }

    public function show(Ingredient $ingredient): IngredientResource
    {
        return new IngredientResource($ingredient);
    }

    public function update(IngredientRequest $request, Ingredient $ingredient): IngredientResource
    {
        $ingredient->update($request->validated());

        return new IngredientResource($ingredient->refresh());
    }

    public function destroy(Ingredient $ingredient): Response
    {
        if ($ingredient->recipeItems()->exists() || $ingredient->stockMovements()->exists()) {
            throw new DomainException('Ingrediente com histórico ou receita vinculada não pode ser excluído.');
        }

        $ingredient->delete();

        return response()->noContent();
    }

    public function movements(Ingredient $ingredient): AnonymousResourceCollection
    {
        return StockMovementResource::collection(
            $ingredient->stockMovements()->latest()->paginate(50),
        );
    }

    public function storeMovement(
        StockMovementRequest $request,
        Ingredient $ingredient,
    ): StockMovementResource {
        return new StockMovementResource(
            $this->stockService->adjust($ingredient, $request->validated()),
        );
    }
}
