<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class SupabaseAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.supabase.auth_bypass' => false,
            'services.supabase.url' => 'https://example.supabase.co',
            'services.supabase.public_key' => 'public-key',
        ]);
    }

    public function test_protected_route_rejects_missing_token(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_supabase_token_resolves_public_user(): void
    {
        $id = (string) Str::uuid();
        User::query()->create([
            'id' => $id,
            'name' => 'Bruna',
            'email' => 'bruna@example.com',
            'password' => '',
            'role' => 'admin',
        ]);
        Http::fake([
            'https://example.supabase.co/auth/v1/user' => Http::response(['id' => $id]),
        ]);

        $this->withToken('valid-token')
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson([
                'id' => $id,
                'email' => 'bruna@example.com',
                'role' => 'admin',
            ]);

        Http::assertSent(fn ($request) => $request->hasHeader('apikey', 'public-key'));
    }

    public function test_supabase_token_rejects_inactive_public_user(): void
    {
        $id = (string) Str::uuid();
        User::query()->create([
            'id' => $id,
            'name' => 'Bruna',
            'email' => 'bruna@example.com',
            'password' => '',
            'role' => 'operador',
            'active' => false,
        ]);
        Http::fake([
            'https://example.supabase.co/auth/v1/user' => Http::response([
                'id' => $id,
                'email' => 'bruna@example.com',
                'user_metadata' => ['full_name' => 'Bruna Del Rio'],
            ]),
        ]);

        $this->withToken('valid-token')
            ->getJson('/api/me')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Usuário desativado.');
    }

    public function test_supabase_token_auto_provisions_missing_public_user(): void
    {
        $id = (string) Str::uuid();
        Http::fake([
            'https://example.supabase.co/auth/v1/user' => Http::response([
                'id' => $id,
                'email' => 'bruna@example.com',
                'user_metadata' => ['full_name' => 'Bruna Del Rio'],
            ]),
        ]);

        $this->withToken('valid-token')
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson([
                'id' => $id,
                'email' => 'bruna@example.com',
                'name' => 'Bruna Del Rio',
                'role' => 'operador',
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $id,
            'email' => 'bruna@example.com',
            'name' => 'Bruna Del Rio',
            'role' => 'operador',
        ]);
    }
}