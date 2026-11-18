-- Voyago 0003: mark items to pack on the morning of travel
alter table public.packing_items add column if not exists pack_when text not null default 'any'
  check (pack_when in ('any','last_minute'));
