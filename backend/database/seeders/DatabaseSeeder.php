<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->firstOrCreate([
            'email' => 'admin@bigpizza.local',
        ], [
            'id' => (string) Str::uuid(),
            'name' => 'Administrador',
            'password' => '',
            'role' => 'admin',
        ]);
    }
}
