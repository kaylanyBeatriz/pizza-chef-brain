<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['id', 'name', 'email', 'password', 'role'])]
class User extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';
}
