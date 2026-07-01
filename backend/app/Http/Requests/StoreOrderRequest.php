<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'order_type' => ['required', Rule::in(['pickup', 'delivery', 'dine_in'])],
            'delivery_address' => ['required_if:order_type,delivery', 'nullable', 'string'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pizza_id' => ['required', 'integer', 'exists:pizzas,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
