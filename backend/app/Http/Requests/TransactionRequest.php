<?php

namespace App\Http\Requests;

use App\Models\Transaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in([Transaction::TYPE_INCOME, Transaction::TYPE_EXPENSE])],
            'description' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'payment_method' => ['nullable', Rule::in(['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outro'])],
            'counterparty' => ['nullable', 'string', 'max:255'],
            'due_date' => ['required', 'date'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
