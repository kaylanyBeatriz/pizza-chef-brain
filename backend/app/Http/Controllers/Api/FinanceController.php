<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $now = CarbonImmutable::now('America/Sao_Paulo');
        $from = CarbonImmutable::parse($validated['from'] ?? $now->startOfMonth()->toDateString())->startOfDay();
        $to = CarbonImmutable::parse($validated['to'] ?? $now->toDateString())->startOfDay();
        $today = $now->toDateString();

        // Realizado: lançamentos pagos cuja data de pagamento cai no período.
        $paid = Transaction::query()->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from->toDateString(), $to->toDateString()]);

        $income = (float) (clone $paid)->where('type', Transaction::TYPE_INCOME)->sum('amount');
        $expense = (float) (clone $paid)->where('type', Transaction::TYPE_EXPENSE)->sum('amount');

        $open = Transaction::query()->whereNull('paid_at');
        $receivable = (clone $open)->where('type', Transaction::TYPE_INCOME);
        $payable = (clone $open)->where('type', Transaction::TYPE_EXPENSE);

        $byDay = (clone $paid)
            ->selectRaw('paid_at as day, type, SUM(amount) as total')
            ->groupBy('paid_at', 'type')
            ->get()
            ->groupBy(fn ($row) => CarbonImmutable::parse($row->day)->toDateString());

        $daily = [];
        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            $rows = $byDay->get($day->toDateString(), collect());
            $daily[] = [
                'dia' => $day->format('d/m'),
                'entradas' => round((float) $rows->firstWhere('type', Transaction::TYPE_INCOME)?->total, 2),
                'saidas' => round((float) $rows->firstWhere('type', Transaction::TYPE_EXPENSE)?->total, 2),
            ];
        }

        $byCategory = (clone $paid)
            ->selectRaw('type, category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('type', 'category')
            ->orderByDesc(DB::raw('SUM(amount)'))
            ->get()
            ->map(fn ($row) => [
                'type' => $row->type,
                'category' => $row->category,
                'total' => round((float) $row->total, 2),
                'count' => (int) $row->count,
            ]);

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'income' => round($income, 2),
            'expense' => round($expense, 2),
            'balance' => round($income - $expense, 2),
            'receivable' => [
                'total' => round((float) (clone $receivable)->sum('amount'), 2),
                'count' => (clone $receivable)->count(),
                'overdue' => (clone $receivable)->whereDate('due_date', '<', $today)->count(),
            ],
            'payable' => [
                'total' => round((float) (clone $payable)->sum('amount'), 2),
                'count' => (clone $payable)->count(),
                'overdue' => (clone $payable)->whereDate('due_date', '<', $today)->count(),
            ],
            'daily' => $daily,
            'byCategory' => $byCategory,
        ]);
    }
}
