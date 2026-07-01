<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Requests\PizzaRequest;
use App\Http\Requests\RecipeItemRequest;
use App\Http\Resources\PizzaIngredientResource;
use App\Http\Resources\PizzaResource;
use App\Models\Pizza;
use App\Models\PizzaIngredient;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PizzaController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $pizzas = Pizza::query()
            ->with('recipeItems.ingredient')
            ->when(request()->boolean('active'), fn ($query) => $query->where('is_active', true))
            ->orderBy('name')
            ->paginate(min((int) request('per_page', 100), 200));

        return PizzaResource::collection($pizzas);
    }

    public function store(PizzaRequest $request): PizzaResource
    {
        return new PizzaResource(Pizza::query()->create($request->validated()));
    }

    public function show(Pizza $pizza): PizzaResource
    {
        return new PizzaResource($pizza->load('recipeItems.ingredient'));
    }

    public function update(PizzaRequest $request, Pizza $pizza): PizzaResource
    {
        $pizza->update($request->validated());

        return new PizzaResource($pizza->refresh()->load('recipeItems.ingredient'));
    }

    public function destroy(Pizza $pizza): Response
    {
        if ($pizza->orderItems()->exists()) {
            throw new DomainException('Pizza presente em pedidos não pode ser excluída.');
        }

        $pizza->delete();

        return response()->noContent();
    }

    public function recipe(Pizza $pizza): AnonymousResourceCollection
    {
        return PizzaIngredientResource::collection(
            $pizza->recipeItems()->with('ingredient')->orderBy('created_at')->get(),
        );
    }

    public function storeRecipeItem(RecipeItemRequest $request, Pizza $pizza): PizzaIngredientResource
    {
        $item = $pizza->recipeItems()->updateOrCreate(
            ['ingredient_id' => $request->integer('ingredient_id')],
            ['quantity' => $request->validated('quantity')],
        );

        return new PizzaIngredientResource($item->load('ingredient'));
    }

    public function destroyRecipeItem(Pizza $pizza, PizzaIngredient $recipeItem): Response
    {
        if ($recipeItem->pizza_id !== $pizza->id) {
            abort(404);
        }
        $recipeItem->delete();

        return response()->noContent();
    }
}
