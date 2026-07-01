<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserAdminUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role' => ['sometimes', 'required', Rule::in(['admin', 'gerente', 'operador'])],
            'active' => ['sometimes', 'required', 'boolean'],
        ];
    }
}
