<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinanceApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.supabase.auth_bypass' => true]);
    }

    public function test_transaction_crud_and_payment_flow(): void
    {
        $today = CarbonImmutable::today('America/Sao_Paulo');

        $id = $this->postJson('/api/finance/transactions', [
            'type' => 'expense', 'description' => 'Conta de luz', 'category' => 'Contas',
            'amount' => 350.5, 'due_date' => $today->subDay()->toDateString(),
        ])->assertSuccessful()->assertJsonPath('data.status', 'overdue')->json('data.id');

        $this->patchJson("/api/finance/transactions/{$id}/pay")
            ->assertOk()->assertJsonPath('data.status', 'paid')->assertJsonPath('data.paid_at', $today->toDateString());

        $this->patchJson("/api/finance/transactions/{$id}/unpay")->assertOk()->assertJsonPath('data.status', 'overdue');

        $this->putJson("/api/finance/transactions/{$id}", [
            'type' => 'expense', 'description' => 'Conta de luz', 'category' => 'Contas',
            'amount' => 400, 'due_date' => $today->addDays(5)->toDateString(),
        ])->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.amount', 400);

        $this->getJson('/api/finance/transactions?search=LUZ&status=pending')->assertOk()->assertJsonCount(1, 'data');
        $this->deleteJson("/api/finance/transactions/{$id}")->assertNoContent();
    }

    public function test_summary_totals_only_paid_entries_in_period(): void
    {
        $today = CarbonImmutable::today('America/Sao_Paulo')->toDateString();

        $this->postJson('/api/finance/transactions', [
            'type' => 'income', 'description' => 'Vendas', 'category' => 'Vendas',
            'amount' => 1000, 'due_date' => $today, 'paid_at' => $today,
        ])->assertSuccessful();
        $this->postJson('/api/finance/transactions', [
            'type' => 'expense', 'description' => 'Fornecedor', 'category' => 'Insumos',
            'amount' => 300, 'due_date' => $today, 'paid_at' => $today,
        ])->assertSuccessful();
        $this->postJson('/api/finance/transactions', [
            'type' => 'income', 'description' => 'Evento', 'category' => 'Eventos',
            'amount' => 500, 'due_date' => $today,
        ])->assertSuccessful();

        $this->getJson("/api/finance/summary?from={$today}&to={$today}")
            ->assertOk()
            ->assertJsonPath('income', 1000)
            ->assertJsonPath('expense', 300)
            ->assertJsonPath('balance', 700)
            ->assertJsonPath('receivable.total', 500)
            ->assertJsonPath('receivable.count', 1);
    }

    public function test_validation_rejects_invalid_amount(): void
    {
        $this->postJson('/api/finance/transactions', [
            'type' => 'income', 'description' => 'X', 'category' => 'Y', 'amount' => 0, 'due_date' => '2026-10-01',
        ])->assertStatus(422);
    }
}
