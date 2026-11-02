<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Category;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class TransactionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'type' => ['nullable', 'in:income,expense'],
            'status' => ['nullable', 'in:paid,pending,overdue'],
            'category' => ['nullable', 'string', 'max:80'],
            'search' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'date_field' => ['nullable', 'in:due_date,paid_at'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $today = CarbonImmutable::today('America/Sao_Paulo')->toDateString();
        // Período aplicado ao vencimento (contas) ou à data do pagamento (lançamentos realizados).
        $dateField = $filters['date_field'] ?? 'due_date';

        $query = Transaction::query()
            ->when($filters['type'] ?? null, fn (Builder $q, string $v) => $q->where('type', $v))
            ->when($filters['category'] ?? null, fn (Builder $q, string $v) => $q->where('category', $v))
            ->when($filters['search'] ?? null, fn (Builder $q, string $v) => $q->where(function (Builder $w) use ($v): void {
                $like = '%'.mb_strtolower($v).'%';
                $w->whereRaw('LOWER(description) LIKE ?', [$like])->orWhereRaw('LOWER(counterparty) LIKE ?', [$like]);
            }))
            ->when($filters['from'] ?? null, fn (Builder $q, string $v) => $q->whereDate($dateField, '>=', $v))
            ->when($filters['to'] ?? null, fn (Builder $q, string $v) => $q->whereDate($dateField, '<=', $v))
            ->when($filters['status'] ?? null, fn (Builder $q, string $v) => match ($v) {
                'paid' => $q->whereNotNull('paid_at'),
                'pending' => $q->whereNull('paid_at')->whereDate('due_date', '>=', $today),
                'overdue' => $q->whereNull('paid_at')->whereDate('due_date', '<', $today),
            })
            ->orderByDesc($dateField)
            ->orderByDesc('id');

        return TransactionResource::collection($query->paginate((int) ($filters['per_page'] ?? 200)));
    }

    public function store(TransactionRequest $request): TransactionResource
    {
        $data = $request->validated();
        Category::query()->firstOrCreate(['type' => $data['type'], 'name' => $data['category']]);

        return new TransactionResource(Transaction::query()->create($data));
    }

    public function show(Transaction $transaction): TransactionResource
    {
        return new TransactionResource($transaction);
    }

    public function update(TransactionRequest $request, Transaction $transaction): TransactionResource
    {
        $data = $request->validated();
        Category::query()->firstOrCreate(['type' => $data['type'], 'name' => $data['category']]);
        $transaction->update($data);

        return new TransactionResource($transaction->refresh());
    }

    public function destroy(Transaction $transaction): Response
    {
        $transaction->delete();

        return response()->noContent();
    }

    public function pay(Request $request, Transaction $transaction): TransactionResource
    {
        $data = $request->validate(['paid_at' => ['nullable', 'date']]);
        $transaction->update([
            'paid_at' => $data['paid_at'] ?? CarbonImmutable::today('America/Sao_Paulo')->toDateString(),
        ]);

        return new TransactionResource($transaction->refresh());
    }

    public function unpay(Transaction $transaction): TransactionResource
    {
        $transaction->update(['paid_at' => null]);

        return new TransactionResource($transaction->refresh());
    }
}
