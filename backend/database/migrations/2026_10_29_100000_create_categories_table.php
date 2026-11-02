<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 10);
            $table->string('name', 80);
            $table->timestamps();
            $table->unique(['type', 'name']);
        });

        $defaults = [
            'income' => ['Vendas balcão', 'Delivery', 'Eventos', 'Outras receitas'],
            'expense' => ['Aluguel', 'Luz', 'Água', 'Gás', 'Impostos', 'Marketing', 'Manutenção', 'Entregas', 'Outras despesas'],
        ];
        $now = now();

        foreach ($defaults as $type => $names) {
            DB::table('categories')->insert(array_map(
                fn (string $name) => ['type' => $type, 'name' => $name, 'created_at' => $now, 'updated_at' => $now],
                $names,
            ));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
