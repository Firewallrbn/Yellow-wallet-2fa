-- Schema aislado del laboratorio 2FA. Convive con Afirmative Pill (schema public)
-- en el mismo proyecto Supabase sin tocar ninguna de sus tablas.
create schema if not exists mfa_lab;

-- No se expone a la API de datos de Supabase: solo el backend FastAPI entra aquí.
revoke all on schema mfa_lab from public;
revoke all on schema mfa_lab from anon, authenticated;

create table if not exists mfa_lab.users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique check (email = lower(email)),
    full_name     text not null,
    password_hash text not null,
    created_at    timestamptz not null default now()
);

-- Process Manager del aprovisionamiento 2FA.
-- Un registro solo existe desde que el usuario pide activar 2FA (PENDING_VERIFICATION)
-- y pasa a ACTIVE únicamente cuando envía su primer código válido.
create table if not exists mfa_lab.mfa_enrollments (
    user_id          uuid primary key references mfa_lab.users (id) on delete cascade,
    status           text not null check (status in ('PENDING_VERIFICATION', 'ACTIVE')),
    secret_encrypted text not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    activated_at     timestamptz
);

-- Códigos de emergencia de un solo uso. Se guarda solo su HMAC, nunca el código.
create table if not exists mfa_lab.backup_codes (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references mfa_lab.users (id) on delete cascade,
    code_hash  text not null,
    used_at    timestamptz,
    created_at timestamptz not null default now(),
    unique (user_id, code_hash)
);
create index if not exists backup_codes_user_idx on mfa_lab.backup_codes (user_id);

-- Datos de la billetera: lo que protege GET /api/boveda-secreta.
create table if not exists mfa_lab.wallets (
    user_id      uuid primary key references mfa_lab.users (id) on delete cascade,
    balance      numeric(14, 2) not null,
    currency     text not null default 'USD',
    card_brand   text not null default 'VISA',
    card_number  text not null,
    card_cvv     text not null,
    card_expiry  text not null,
    card_holder  text not null
);

create table if not exists mfa_lab.transactions (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references mfa_lab.users (id) on delete cascade,
    kind         text not null check (kind in ('send', 'receive', 'deposit', 'withdraw')),
    counterparty text not null,
    amount       numeric(14, 2) not null,
    occurred_at  timestamptz not null default now()
);
create index if not exists transactions_user_time_idx
    on mfa_lab.transactions (user_id, occurred_at desc);

-- Defensa en profundidad: RLS sin políticas. Aunque alguien expusiera el schema por
-- PostgREST, anon/authenticated no verían nada. El backend entra como dueño de las tablas.
alter table mfa_lab.users           enable row level security;
alter table mfa_lab.mfa_enrollments enable row level security;
alter table mfa_lab.backup_codes    enable row level security;
alter table mfa_lab.wallets         enable row level security;
alter table mfa_lab.transactions    enable row level security;
