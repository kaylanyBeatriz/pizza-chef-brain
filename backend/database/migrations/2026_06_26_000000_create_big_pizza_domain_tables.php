<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('unit', 10)->default('kg');
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->decimal('minimum_stock', 12, 3)->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->timestamps();
        });

        Schema::create('pizzas', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category')->default('Pizza');
            $table->decimal('price', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('pizza_ingredients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pizza_id')->constrained('pizzas')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['pizza_id', 'ingredient_id']);
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->string('customer_name', 120)->nullable();
            $table->string('customer_phone', 30)->nullable();
            $table->string('order_type', 30)->default('pickup');
            $table->text('delivery_address')->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->decimal('subtotal_amount', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->boolean('stock_deducted')->default(false);
            $table->timestamp('stock_deducted_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('preparing_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('updated_at')->useCurrent();
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('pizza_id')->constrained('pizzas')->restrictOnDelete();
            $table->string('pizza_name');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('pizza_ingredients');
        Schema::dropIfExists('pizzas');
        Schema::dropIfExists('ingredients');
    }
};
