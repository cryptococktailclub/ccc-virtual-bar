create table if not exists batch_users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists batch_sessions (
  id uuid primary key,
  user_id uuid not null references batch_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists batch_saved_recipes (
  id uuid primary key,
  user_id uuid not null references batch_users(id) on delete cascade,
  name text not null,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists batch_saved_recipes_user_idx
  on batch_saved_recipes(user_id, updated_at desc);

create table if not exists batch_saved_batches (
  id uuid primary key,
  user_id uuid not null references batch_users(id) on delete cascade,
  recipe_id uuid null,
  recipe_name text not null,
  recipe_snapshot jsonb not null,
  batch_inputs jsonb not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists batch_saved_batches_user_idx
  on batch_saved_batches(user_id, created_at desc);
