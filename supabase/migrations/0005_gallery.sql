-- =========================================================================
-- 0005 · Company-wide gallery
-- =========================================================================
-- Adds a shared gallery where any authenticated user can browse 3D models
-- that other users have explicitly shared. One gallery row per job
-- (the user can toggle visibility on/off without losing stats).
--
-- New objects:
--   * public.profiles          - exposes a display_name without leaking emails
--   * public.gallery_items     - the shared post (1:1 with public.jobs)
--   * public.gallery_likes     - per-user like, drives gallery_items.like_count
--   * public.gallery_comments  - threaded-flat comments
--   * public.increment_gallery_view(uuid) - security-definer view counter
--
-- Moderation columns are present (moderation, reported_count) so an admin
-- surface can be added later without another migration. Default state is
-- 'approved' because no admin role exists yet.
-- =========================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------
-- profiles · per-user public display name
-- ----------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger to auto-create a profile on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
begin
  base_name := coalesce(
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'creator'
  );
  insert into public.profiles (id, display_name)
  values (new.id, base_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any pre-existing users.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'creator')
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "profiles: read all" on public.profiles;
create policy "profiles: read all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------
-- gallery_items · one row per shared job
-- ----------------------------------------------------------------------
-- Note: user_id references profiles(id) (not auth.users) so PostgREST can
-- embed the author profile via the single FK. profiles cascades from
-- auth.users, so deleting a user still cleans this up.
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  visibility text not null default 'public'
    check (visibility in ('private','public')),
  moderation text not null default 'approved'
    check (moderation in ('pending','approved','rejected')),
  view_count int not null default 0,
  like_count int not null default 0,
  comment_count int not null default 0,
  reported_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_items_public_feed_idx
  on public.gallery_items (created_at desc)
  where visibility = 'public' and moderation = 'approved';

create index if not exists gallery_items_user_idx
  on public.gallery_items (user_id, created_at desc);

drop trigger if exists gallery_items_set_updated_at on public.gallery_items;
create trigger gallery_items_set_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

alter table public.gallery_items enable row level security;

drop policy if exists "gallery_items: read public or own" on public.gallery_items;
create policy "gallery_items: read public or own"
  on public.gallery_items for select
  to authenticated
  using (
    (visibility = 'public' and moderation = 'approved')
    or user_id = auth.uid()
  );

drop policy if exists "gallery_items: insert own" on public.gallery_items;
create policy "gallery_items: insert own"
  on public.gallery_items for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "gallery_items: update own" on public.gallery_items;
create policy "gallery_items: update own"
  on public.gallery_items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "gallery_items: delete own" on public.gallery_items;
create policy "gallery_items: delete own"
  on public.gallery_items for delete
  to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------
-- gallery_likes · drives gallery_items.like_count via trigger
-- ----------------------------------------------------------------------
create table if not exists public.gallery_likes (
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gallery_item_id, user_id)
);

create index if not exists gallery_likes_user_idx
  on public.gallery_likes (user_id);

alter table public.gallery_likes enable row level security;

drop policy if exists "gallery_likes: read visible" on public.gallery_likes;
create policy "gallery_likes: read visible"
  on public.gallery_likes for select
  to authenticated
  using (
    exists (
      select 1 from public.gallery_items gi
      where gi.id = gallery_item_id
        and (
          (gi.visibility = 'public' and gi.moderation = 'approved')
          or gi.user_id = auth.uid()
        )
    )
  );

drop policy if exists "gallery_likes: like as self" on public.gallery_likes;
create policy "gallery_likes: like as self"
  on public.gallery_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.gallery_items gi
      where gi.id = gallery_item_id
        and gi.visibility = 'public'
        and gi.moderation = 'approved'
    )
  );

drop policy if exists "gallery_likes: unlike own" on public.gallery_likes;
create policy "gallery_likes: unlike own"
  on public.gallery_likes for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.bump_gallery_like_count()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update public.gallery_items
       set like_count = like_count + 1
     where id = NEW.gallery_item_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.gallery_items
       set like_count = greatest(0, like_count - 1)
     where id = OLD.gallery_item_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists gallery_likes_count on public.gallery_likes;
create trigger gallery_likes_count
  after insert or delete on public.gallery_likes
  for each row execute function public.bump_gallery_like_count();

-- ----------------------------------------------------------------------
-- gallery_comments · flat list, owner of item can delete any comment
-- ----------------------------------------------------------------------
create table if not exists public.gallery_comments (
  id uuid primary key default gen_random_uuid(),
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists gallery_comments_item_idx
  on public.gallery_comments (gallery_item_id, created_at desc);

alter table public.gallery_comments enable row level security;

drop policy if exists "gallery_comments: read visible" on public.gallery_comments;
create policy "gallery_comments: read visible"
  on public.gallery_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.gallery_items gi
      where gi.id = gallery_item_id
        and (
          (gi.visibility = 'public' and gi.moderation = 'approved')
          or gi.user_id = auth.uid()
        )
    )
  );

drop policy if exists "gallery_comments: insert as self on public" on public.gallery_comments;
create policy "gallery_comments: insert as self on public"
  on public.gallery_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.gallery_items gi
      where gi.id = gallery_item_id
        and gi.visibility = 'public'
        and gi.moderation = 'approved'
    )
  );

drop policy if exists "gallery_comments: delete own or by item owner" on public.gallery_comments;
create policy "gallery_comments: delete own or by item owner"
  on public.gallery_comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.gallery_items gi
      where gi.id = gallery_item_id and gi.user_id = auth.uid()
    )
  );

create or replace function public.bump_gallery_comment_count()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update public.gallery_items
       set comment_count = comment_count + 1
     where id = NEW.gallery_item_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.gallery_items
       set comment_count = greatest(0, comment_count - 1)
     where id = OLD.gallery_item_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists gallery_comments_count on public.gallery_comments;
create trigger gallery_comments_count
  after insert or delete on public.gallery_comments
  for each row execute function public.bump_gallery_comment_count();

-- ----------------------------------------------------------------------
-- View counter · increment safely without giving UPDATE rights on the table
-- ----------------------------------------------------------------------
create or replace function public.increment_gallery_view(item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.gallery_items
     set view_count = view_count + 1
   where id = item_id
     and visibility = 'public'
     and moderation = 'approved';
$$;

revoke all on function public.increment_gallery_view(uuid) from public;
grant execute on function public.increment_gallery_view(uuid) to authenticated;

-- ----------------------------------------------------------------------
-- Realtime: feed + reaction streams
-- ----------------------------------------------------------------------
alter publication supabase_realtime add table public.gallery_items;
alter publication supabase_realtime add table public.gallery_likes;
alter publication supabase_realtime add table public.gallery_comments;
