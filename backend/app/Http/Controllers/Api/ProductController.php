<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Requests\RecipeItemRequest;
use App\Http\Resources\ProductIngredientResource;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductIngredient;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ProductController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ProductResource::collection(
            Product::query()
                ->with('recipeItems.ingredient')
                ->orderBy('category')
                ->orderBy('name')
                ->paginate(50),
        );
    }

    public function store(ProductRequest $request): ProductResource
    {
        $product = Product::query()->create($request->validated());

        return new ProductResource($product->load('recipeItems.ingredient'));
    }

    public function show(Product $product): ProductResource
    {
        return new ProductResource($product->load('recipeItems.ingredient'));
    }

    public function update(ProductRequest $request, Product $product): ProductResource
    {
        $product->update($request->validated());

        return new ProductResource($product->refresh()->load('recipeItems.ingredient'));
    }

    public function destroy(Product $product): Response
    {
        if ($product->orderItems()->exists()) {
            throw new DomainException('Produto presente em pedidos não pode ser excluído.');
        }

        $product->delete();

        return response()->noContent();
    }

    public function recipe(Product $product): AnonymousResourceCollection
    {
        return ProductIngredientResource::collection(
            $product->recipeItems()->with('ingredient')->orderBy('created_at')->get(),
        );
    }

    public function storeRecipeItem(
        RecipeItemRequest $request,
        Product $product,
    ): ProductIngredientResource {
        $recipeItem = $product->recipeItems()->updateOrCreate(
            ['ingredient_id' => $request->validated('ingredient_id')],
            ['quantity' => $request->validated('quantity')],
        );

        return new ProductIngredientResource($recipeItem->load('ingredient'));
    }

    public function destroyRecipeItem(
        Product $product,
        ProductIngredient $recipeItem,
    ): Response {
        if ($recipeItem->product_id !== $product->id) {
            abort(404);
        }

        $recipeItem->delete();

        return response()->noContent();
    }
}
