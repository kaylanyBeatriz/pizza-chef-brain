<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Requests\IngredientRequest;
use App\Http\Resources\IngredientResource;
use App\Models\Ingredient;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class IngredientController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return IngredientResource::collection(
            Ingredient::query()->orderBy('name')->paginate(min((int) request('per_page', 100), 200)),
        );
    }

    public function store(IngredientRequest $request): IngredientResource
    {
        return new IngredientResource(Ingredient::query()->create($request->validated()));
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
        if ($ingredient->recipeItems()->exists()) {
            throw new DomainException('Ingrediente vinculado a uma receita não pode ser excluído.');
        }

        $ingredient->delete();

        return response()->noContent();
    }
}
