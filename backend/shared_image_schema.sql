insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  350000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.product_image_candidates (
  id uuid primary key default gen_random_uuid(),
  jan_code text not null default '',
  box_name text not null,
  normalized_box_name text not null,
  series_name text not null default '',
  character_name text not null default '',
  normalized_character_name text not null default '',
  variant_name text not null default '通常版',
  normalized_variant_name text not null default '通常版',
  image_kind text not null default 'parent' check (image_kind in ('parent', 'variant')),
  storage_path text not null,
  public_url text not null,
  sha256 text not null,
  perceptual_hash text,
  mime_type text not null,
  width integer,
  height integer,
  file_size integer not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'deleted')),
  selected_count integer not null default 0,
  rejected_count integer not null default 0,
  report_count integer not null default 0,
  same_image_count integer not null default 1,
  device_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_selected_at timestamptz
);

create index if not exists product_image_candidates_jan_idx
on public.product_image_candidates (jan_code, image_kind, status);

create index if not exists product_image_candidates_box_idx
on public.product_image_candidates (normalized_box_name, image_kind, status);

create index if not exists product_image_candidates_variant_idx
on public.product_image_candidates (
  jan_code,
  normalized_box_name,
  normalized_character_name,
  normalized_variant_name,
  image_kind,
  status
);

create unique index if not exists product_image_candidates_unique_sha_idx
on public.product_image_candidates (
  coalesce(jan_code, ''),
  normalized_box_name,
  normalized_character_name,
  normalized_variant_name,
  image_kind,
  sha256
);

create table if not exists public.product_image_votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.product_image_candidates(id) on delete cascade,
  device_hash text not null,
  action text not null check (action in ('selected', 'rejected', 'reported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_image_votes_unique_idx
on public.product_image_votes (candidate_id, device_hash);

alter table public.product_image_candidates enable row level security;
alter table public.product_image_votes enable row level security;

revoke all on public.product_image_candidates from anon, authenticated;
revoke all on public.product_image_votes from anon, authenticated;

drop policy if exists "service_role_product_image_candidates_all" on public.product_image_candidates;
create policy "service_role_product_image_candidates_all"
on public.product_image_candidates
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_product_image_votes_all" on public.product_image_votes;
create policy "service_role_product_image_votes_all"
on public.product_image_votes
for all
to service_role
using (true)
with check (true);
