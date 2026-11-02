<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $type = $request->validate(['type' => ['nullable', 'in:income,expense']])['type'] ?? null;

        $categories = Category::query()
            ->when($type, fn ($q, string $t) => $q->where('type', $t))
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'type', 'name']);

        $usage = Transaction::query()
            ->selectRaw('type, category, COUNT(*) as total')
            ->groupBy('type', 'category')
            ->get()
            ->mapWithKeys(fn ($row) => ["{$row->type}|{$row->category}" => (int) $row->total]);

        return response()->json(['data' => $categories->map(fn (Category $c) => [
            'id' => (string) $c->id,
            'type' => $c->type,
            'name' => $c->name,
            'usage' => $usage->get("{$c->type}|{$c->name}", 0),
        ])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $category = Category::query()->create($data);

        return response()->json(['data' => [
            'id' => (string) $category->id, 'type' => $category->type, 'name' => $category->name, 'usage' => 0,
        ]], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $this->validated($request, $category);

        // Renomear mantém os lançamentos já feitos ligados à categoria.
        DB::transaction(function () use ($category, $data): void {
            Transaction::query()
                ->where('type', $category->type)
                ->where('category', $category->name)
                ->update(['category' => $data['name']]);
            $category->update(['name' => $data['name']]);
        });

        return response()->json(['data' => [
            'id' => (string) $category->id, 'type' => $category->type, 'name' => $category->name,
        ]]);
    }

    public function destroy(Category $category): Response
    {
        $used = Transaction::query()->where('type', $category->type)->where('category', $category->name)->count();

        if ($used > 0) {
            throw new DomainException("Categoria em uso por {$used} lançamento(s). Renomeie-a ou altere os lançamentos antes de excluir.");
        }

        $category->delete();

        return response()->noContent();
    }

    /** @return array{type: string, name: string} */
    private function validated(Request $request, ?Category $category = null): array
    {
        $type = $category?->type ?? $request->input('type');

        $data = $request->validate([
            'type' => [$category ? 'prohibited' : 'required', Rule::in([Transaction::TYPE_INCOME, Transaction::TYPE_EXPENSE])],
            'name' => [
                'required', 'string', 'max:80',
                Rule::unique('categories', 'name')->where('type', $type)->ignore($category?->id),
            ],
        ], ['name.unique' => 'Já existe uma categoria com esse nome.']);

        $data['name'] = trim($data['name']);
        $data['type'] = $type;

        return $data;
    }
}
