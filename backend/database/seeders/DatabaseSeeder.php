<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $roles = collect(['admin', 'gerente', 'operador'])
            ->mapWithKeys(fn (string $name) => [
                $name => Role::query()->firstOrCreate(['name' => $name]),
            ]);

        $user = User::query()->firstOrCreate([
            'email' => 'admin@bigpizza.local',
        ], [
            'name' => 'Administrador',
            'password' => 'password',
        ]);

        $user->roles()->syncWithoutDetaching([$roles['admin']->id]);
    }
}
