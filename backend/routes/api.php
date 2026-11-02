<?php

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\IngredientController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PizzaController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);

Route::middleware('supabase.auth')->group(function (): void {
    Route::get('/me', MeController::class);

    Route::get('ingredients', [IngredientController::class, 'index']);
    Route::get('ingredients/{ingredient}', [IngredientController::class, 'show']);
    Route::middleware('role:admin,gerente')->group(function (): void {
        Route::post('ingredients', [IngredientController::class, 'store']);
        Route::put('ingredients/{ingredient}', [IngredientController::class, 'update']);
        Route::delete('ingredients/{ingredient}', [IngredientController::class, 'destroy']);
    });

    Route::get('pizzas', [PizzaController::class, 'index']);
    Route::get('pizzas/{pizza}', [PizzaController::class, 'show']);
    Route::get('pizzas/{pizza}/recipe', [PizzaController::class, 'recipe']);
    Route::middleware('role:admin,gerente')->group(function (): void {
        Route::post('pizzas', [PizzaController::class, 'store']);
        Route::put('pizzas/{pizza}', [PizzaController::class, 'update']);
        Route::delete('pizzas/{pizza}', [PizzaController::class, 'destroy']);
        Route::post('pizzas/{pizza}/recipe', [PizzaController::class, 'storeRecipeItem']);
        Route::delete('pizzas/{pizza}/recipe/{recipeItem}', [PizzaController::class, 'destroyRecipeItem']);
    });

    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store']);
    Route::get('orders/{order}', [OrderController::class, 'show']);
    Route::patch('orders/{order}/status', [OrderController::class, 'updateStatus']);

    Route::middleware('role:admin')->group(function (): void {
        Route::get('users', [UserController::class, 'index']);
        Route::patch('users/{user}', [UserController::class, 'update']);
        Route::delete('users/{user}', [UserController::class, 'destroy']);
    });

    Route::middleware('role:admin,gerente')->prefix('finance')->group(function (): void {
        Route::get('summary', [FinanceController::class, 'summary']);
        Route::get('categories', [CategoryController::class, 'index']);
        Route::post('categories', [CategoryController::class, 'store']);
        Route::put('categories/{category}', [CategoryController::class, 'update']);
        Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
        Route::get('transactions', [TransactionController::class, 'index']);
        Route::post('transactions', [TransactionController::class, 'store']);
        Route::get('transactions/{transaction}', [TransactionController::class, 'show']);
        Route::put('transactions/{transaction}', [TransactionController::class, 'update']);
        Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy']);
        Route::patch('transactions/{transaction}/pay', [TransactionController::class, 'pay']);
        Route::patch('transactions/{transaction}/unpay', [TransactionController::class, 'unpay']);
    });

    Route::get('dashboard', [DashboardController::class, 'dashboard']);
    Route::get('reports/consumption', [DashboardController::class, 'consumption']);
    Route::get('reports/finance', [DashboardController::class, 'finance'])->middleware('role:admin,gerente');
});
