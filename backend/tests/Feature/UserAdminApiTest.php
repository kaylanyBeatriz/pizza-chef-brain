<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAdminApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.supabase.auth_bypass' => true]);
    }

    public function test_admin_can_list_update_deactivate_and_delete_users(): void
    {
        $operator = User::query()->create([
            'id' => '11111111-1111-1111-1111-111111111111',
            'name' => 'Operador',
            'email' => 'operador@example.com',
            'password' => '',
            'role' => 'operador',
            'active' => true,
        ]);

        $this->getJson('/api/users')->assertOk()->assertJsonPath('data.0.email', 'operador@example.com');

        $this->patchJson("/api/users/{$operator->id}", ['role' => 'gerente'])
            ->assertOk()
            ->assertJsonPath('data.role', 'gerente');

        $this->patchJson("/api/users/{$operator->id}", ['active' => false])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->deleteJson("/api/users/{$operator->id}")->assertNoContent();
        $this->assertDatabaseMissing('users', ['id' => $operator->id]);
    }

    public function test_admin_cannot_remove_the_last_admin(): void
    {
        User::query()->create([
            'id' => '22222222-2222-2222-2222-222222222222',
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => '',
            'role' => 'admin',
            'active' => true,
        ]);

        $this->patchJson('/api/users/22222222-2222-2222-2222-222222222222', ['active' => false])
            ->assertStatus(422);
    }
}
