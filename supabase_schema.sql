-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Users)
create table profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- RLS Policy: Users can view/edit their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- CONTACTS
create table contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  email text,
  phone text,
  role text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table contacts enable row level security;

create policy "Users can crud own contacts" on contacts for all using (auth.uid() = user_id);

-- DEALS
create table deals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  contact_id uuid references contacts(id),
  title text not null,
  value numeric,
  priority text,
  stage_id text, -- 'lead', 'qualified', etc. (mapped in frontend)
  status text default 'active', -- 'active', 'won', 'lost'
  expected_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table deals enable row level security;

create policy "Users can crud own deals" on deals for all using (auth.uid() = user_id);

-- ACTIVITIES
create table activities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  deal_id uuid references deals(id),
  type text not null, -- 'call', 'meeting', etc.
  title text not null,
  date timestamp with time zone not null,
  duration integer,
  completed boolean default false,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table activities enable row level security;

create policy "Users can crud own activities" on activities for all using (auth.uid() = user_id);

-- Handle User Creation (Trigger)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
