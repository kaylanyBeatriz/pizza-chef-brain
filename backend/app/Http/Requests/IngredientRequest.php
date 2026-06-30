<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IngredientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('ingredients')->ignore($this->route('ingredient'))],
            'unit' => ['required', Rule::in(['kg', 'g', 'L', 'ml', 'un'])],
            'stock_quantity' => $this->isMethod('post')
                ? ['required', 'numeric', 'min:0']
                : ['prohibited'],
            'min_stock' => ['required', 'numeric', 'min:0'],
            'cost_per_unit' => ['required', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:255'],
        ];
    }
}
