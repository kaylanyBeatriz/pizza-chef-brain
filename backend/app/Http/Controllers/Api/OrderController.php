<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orderService) {}

    public function index(): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->with('items.product')
            ->when(request('status'), fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate(50);

        return OrderResource::collection($orders);
    }

    public function store(StoreOrderRequest $request): OrderResource
    {
        return new OrderResource($this->orderService->create($request->validated()));
    }

    public function show(Order $order): OrderResource
    {
        return new OrderResource($order->load('items.product'));
    }

    public function updateStatus(
        UpdateOrderStatusRequest $request,
        Order $order,
    ): OrderResource {
        return new OrderResource(
            $this->orderService->updateStatus($order, $request->validated('status')),
        );
    }
}
