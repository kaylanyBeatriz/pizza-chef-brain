<?php

namespace App\Http\Middleware;

use App\Exceptions\InactiveUserException;
use App\Services\SupabaseAuthService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSupabase
{
    public function __construct(private readonly SupabaseAuthService $authService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token && ! config('services.supabase.auth_bypass')) {
            return new JsonResponse(['message' => 'Token de autenticação ausente.'], 401);
        }

        try {
            $user = $this->authService->authenticate($token ?? 'test');
        } catch (InactiveUserException $exception) {
            return new JsonResponse(['message' => $exception->getMessage()], 403);
        }

        if (! $user) {
            return new JsonResponse(['message' => 'Token inválido ou usuário não cadastrado.'], 401);
        }

        $request->attributes->set('app_user', $user);

        return $next($request);
    }
}
