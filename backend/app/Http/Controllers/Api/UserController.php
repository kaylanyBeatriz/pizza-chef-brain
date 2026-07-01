<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Requests\UserAdminUpdateRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()->orderByDesc('active')->orderBy('name')->get();

        return response()->json([
            'data' => UserResource::collection($users),
        ]);
    }

    public function update(UserAdminUpdateRequest $request, User $user): JsonResponse
    {
        $actor = $request->attributes->get('app_user');
        $payload = $request->validated();

        if ($actor && $actor->id === $user->id && array_key_exists('role', $payload) && $payload['role'] !== $user->role) {
            throw new DomainException('Você não pode alterar o seu próprio tipo de usuário.');
        }

        if ($actor && $actor->id === $user->id && array_key_exists('active', $payload) && $payload['active'] === false) {
            throw new DomainException('Você não pode desativar o seu próprio usuário.');
        }

        if (array_key_exists('role', $payload) && $payload['role'] !== $user->role && $user->role === 'admin') {
            $activeAdmins = User::query()->where('role', 'admin')->where('active', true)->count();
            if ($user->active && $activeAdmins <= 1) {
                throw new DomainException('Não é permitido remover o último administrador ativo.');
            }
        }

        if (array_key_exists('active', $payload) && $payload['active'] === false && $user->role === 'admin') {
            $activeAdmins = User::query()->where('role', 'admin')->where('active', true)->count();
            if ($user->active && $activeAdmins <= 1) {
                throw new DomainException('Não é permitido desativar o último administrador ativo.');
            }
        }

        $user->fill($payload);
        $user->save();

        return response()->json(['data' => new UserResource($user->refresh())]);
    }

    public function destroy(Request $request, User $user): Response
    {
        $actor = $request->attributes->get('app_user');

        if ($actor && $actor->id === $user->id) {
            throw new DomainException('Você não pode excluir o seu próprio usuário.');
        }

        if ($user->role === 'admin') {
            $activeAdmins = User::query()->where('role', 'admin')->where('active', true)->count();
            if ($user->active && $activeAdmins <= 1) {
                throw new DomainException('Não é permitido excluir o último administrador ativo.');
            }
        }

        DB::transaction(function () use ($user): void {
            $user->delete();
        });

        return response()->noContent();
    }
}
