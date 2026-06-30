<?php

namespace App\Http\Requests;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                Order::STATUS_PENDING,
                Order::STATUS_PREPARING,
                Order::STATUS_COMPLETED,
                Order::STATUS_CANCELLED,
            ])],
        ];
    }
}
