<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\IngredientController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);

Route::get('ingredients/{ingredient}/movements', [IngredientController::class, 'movements']);
Route::post('ingredients/{ingredient}/movements', [IngredientController::class, 'storeMovement']);
Route::apiResource('ingredients', IngredientController::class);

Route::get('products/{product}/recipe', [ProductController::class, 'recipe']);
Route::post('products/{product}/recipe', [ProductController::class, 'storeRecipeItem']);
Route::delete('products/{product}/recipe/{recipeItem}', [ProductController::class, 'destroyRecipeItem']);
Route::apiResource('products', ProductController::class);

Route::get('orders', [OrderController::class, 'index']);
Route::post('orders', [OrderController::class, 'store']);
Route::get('orders/{order}', [OrderController::class, 'show']);
Route::patch('orders/{order}/status', [OrderController::class, 'updateStatus']);

Route::get('dashboard', [DashboardController::class, 'dashboard']);
Route::get('reports/consumption', [DashboardController::class, 'consumption']);
Route::get('reports/finance', [DashboardController::class, 'finance']);
