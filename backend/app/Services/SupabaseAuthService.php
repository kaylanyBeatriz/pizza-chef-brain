<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;

class SupabaseAuthService
{
    public function authenticate(string $token): ?User
    {
        if (config('services.supabase.auth_bypass')) {
            return new User([
                'id' => '00000000-0000-0000-0000-000000000001',
                'name' => 'Test Admin',
                'email' => 'admin@example.com',
                'role' => 'admin',
            ]);
        }

        $url = rtrim((string) config('services.supabase.url'), '/');
        $key = (string) config('services.supabase.public_key');

        if ($url === '' || $key === '') {
            return null;
        }

        $response = Http::acceptJson()
            ->withHeaders(['apikey' => $key])
            ->withToken($token)
            ->timeout(10)
            ->get("{$url}/auth/v1/user");

        if (! $response->successful() || ! $response->json('id')) {
            return null;
        }

        $id = (string) $response->json('id');
        $email = (string) ($response->json('email') ?? '');
        $name = (string) data_get($response->json('user_metadata'), 'full_name', '');

        if ($name === '') {
            $name = $email !== '' ? strtok($email, '@') ?: $email : 'Usuário';
        }

        return User::query()->firstOrCreate(
            ['id' => $id],
            [
                'name' => $name,
                'email' => $email,
                'password' => '',
                'role' => 'operador',
            ],
        );
    }
}
