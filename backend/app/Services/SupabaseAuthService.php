<?php

namespace App\Services;

use App\Exceptions\InactiveUserException;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SupabaseAuthService
{
    public function authenticate(string $token): ?User
    {
        if (config('services.supabase.auth_bypass')) {
            return new User([
                'id' => '00000000-0000-0000-0000-000000000001',
                'name' => 'Test Admin',
                'email' => 'admin-bypass@example.com',
                'password' => '',
                'role' => 'admin',
                'active' => true,
            ]);
        }

        $url = rtrim((string) config('services.supabase.url'), '/');
        $key = (string) config('services.supabase.public_key');

        if ($url === '' || $key === '') {
            return null;
        }

        // Evita uma ida ao Supabase a cada requisição: só identidades válidas ficam em cache por 60s.
        $cacheKey = 'supabase-auth:'.hash('sha256', $token);
        $cache = Cache::store('file');
        $identity = $cache->get($cacheKey);

        if ($identity === null) {
            $response = Http::acceptJson()
                ->withHeaders(['apikey' => $key])
                ->withToken($token)
                ->timeout(10)
                ->get("{$url}/auth/v1/user");

            if (! $response->successful() || ! $response->json('id')) {
                return null;
            }

            $identity = [
                'id' => (string) $response->json('id'),
                'email' => (string) ($response->json('email') ?? ''),
                'name' => (string) data_get($response->json('user_metadata'), 'full_name', ''),
            ];
            $cache->put($cacheKey, $identity, 60);
        }

        $id = $identity['id'];
        $email = $identity['email'];
        $name = $identity['name'];

        if ($name === '') {
            $name = $email !== '' ? strtok($email, '@') ?: $email : 'Usuário';
        }

        $user = User::query()->firstOrCreate(
            ['id' => $id],
            [
                'name' => $name,
                'email' => $email,
                'password' => '',
                'role' => 'operador',
                'active' => true,
            ],
        );

        if (! $user->active) {
            throw new InactiveUserException('Usuário desativado.');
        }

        return $user;
    }
}
