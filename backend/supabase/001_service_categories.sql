alter table public.services
  add column if not exists category_id uuid references public.service_categories(id);

create index if not exists services_category_id_idx
  on public.services(category_id);