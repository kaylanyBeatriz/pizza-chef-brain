<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->attributes->get('app_user');

        if (! $user || ! in_array($user->role, $roles, true)) {
            return new JsonResponse(['message' => 'Você não possui permissão para esta ação.'], 403);
        }

        return $next($request);
    }
}
