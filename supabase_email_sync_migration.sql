-- EMAIL SYNC FEATURE MIGRATION
-- This migration creates the necessary tables to support Email Synchronization and Smart BCC.

-- 1. EMAIL ACCOUNTS
-- Stores connection details for user email accounts (Gmail, Outlook, IMAP).
create table if not exists public.email_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email_address text not null,
  provider text not null check (provider in ('gmail', 'outlook', 'exchange', 'icloud', 'yahoo', 'custom_imap', 'other')),
  status text default 'active' check (status in ('active', 'disconnected', 'syncing', 'error')),
  
  -- Connection config (OAuth tokens or encrypted Credentials)
  -- SECURITY NOTE: In a real production env, sensitive IMAP passwords should be stored encrypted via Vault or similar.
  connection_config jsonb default '{}'::jsonb, 
  
  -- Sync Preferences
  sync_settings jsonb default '{
    "sync_start": "1month",
    "sync_sent": true,
    "sync_labels": "all",
    "auto_link": true,
    "tracking_open": true,
    "tracking_click": true,
    "archive_in_crm": false
  }'::jsonb,

  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: Users can only see/manage their own accounts
alter table public.email_accounts enable row level security;
create policy "Users can view own email accounts" on public.email_accounts
  for select using (auth.uid() = user_id);
create policy "Users can insert own email accounts" on public.email_accounts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own email accounts" on public.email_accounts
  for update using (auth.uid() = user_id);
create policy "Users can delete own email accounts" on public.email_accounts
  for delete using (auth.uid() = user_id);


-- 2. EMAILS
-- Stores the actual email messages synced from the provider.
create table if not exists public.emails (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.email_accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null, -- Denormalized for RLS performance
  
  remote_id text not null, -- ID from the provider (IMAP UID or API ID)
  message_id text, -- Internet Message-ID header
  thread_id text, -- To group conversations
  
  subject text,
  snippet text,
  body_text text,
  body_html text,
  
  from_address jsonb not null, -- { "name": "John", "email": "john@doe.com" }
  to_addresses jsonb default '[]'::jsonb, -- [{ "name": "Jane", "email": "jane@doe.com" }]
  cc_addresses jsonb default '[]'::jsonb,
  bcc_addresses jsonb default '[]'::jsonb,
  
  folder text default 'inbox', -- 'inbox', 'sent', 'drafts', 'trash', or custom label
  received_at timestamptz not null,
  
  is_read boolean default false,
  is_archived boolean default false,
  is_tracked boolean default false,
  
  created_at timestamptz default now()
);

-- Indexes for performance (searching and associations)
create index if not exists idx_emails_user_id on public.emails(user_id);
create index if not exists idx_emails_account_id on public.emails(account_id);
create index if not exists idx_emails_remote_id on public.emails(remote_id);
create index if not exists idx_emails_thread_id on public.emails(thread_id);

-- RLS: Users can only see their own emails
alter table public.emails enable row level security;
create policy "Users can view own emails" on public.emails
  for select using (auth.uid() = user_id);
create policy "Users can insert own emails" on public.emails
  for insert with check (auth.uid() = user_id);
create policy "Users can update own emails" on public.emails
  for update using (auth.uid() = user_id);
create policy "Users can delete own emails" on public.emails
  for delete using (auth.uid() = user_id);


-- 3. EMAIL ASSOCIATIONS (Smart Linking)
-- Links a specific email to CRM entities.
-- This allows one email to be linked to a Contact AND a Deal, for example.
create table if not exists public.email_associations (
  id uuid default gen_random_uuid() primary key,
  email_id uuid references public.emails(id) on delete cascade not null,
  
  -- Foreign Keys to CRM Entities
  -- Assuming tables: 'contacts', 'deals', 'organizations', 'leads' exist based on typical schema.
  -- Adjust table names if your schema uses different ones (e.g. 'people' instead of 'contacts').
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  
  -- Metadata about who/what created the link
  created_by_user_id uuid references auth.users(id),
  is_automatic boolean default true, -- true if system linked it, false if user manually linked
  
  created_at timestamptz default now()
);

-- Index for quick lookups defined entities
create index if not exists idx_email_assoc_email_id on public.email_associations(email_id);
create index if not exists idx_email_assoc_contact_id on public.email_associations(contact_id);
create index if not exists idx_email_assoc_deal_id on public.email_associations(deal_id);

-- RLS: Visibility usually depends on the USER'S access to the Email OR the Entity.
-- For simplicity in V1: If you can see the Email, you can see its associations.
alter table public.email_associations enable row level security;
create policy "Users can view associations for their emails" on public.email_associations
  for select using (
    exists (select 1 from public.emails e where e.id = email_associations.email_id and e.user_id = auth.uid())
  );
create policy "Users can manage associations for their emails" on public.email_associations
  for all using (
    exists (select 1 from public.emails e where e.id = email_associations.email_id and e.user_id = auth.uid())
  );


-- 4. AUTHORIZED SENDERS (For Smart BCC validation)
-- Whitelist of email addresses authorized to use the Smart BCC feature for a user.
create table if not exists public.authorized_senders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email_address text not null,
  is_primary boolean default false, -- The user's login email
  is_verified boolean default false, -- Requires confirmation email
  verification_token text,
  
  created_at timestamptz default now()
);

-- Unique constraint: A user cannot add the same email twice
alter table public.authorized_senders add constraint unique_user_email unique (user_id, email_address);

-- RLS
alter table public.authorized_senders enable row level security;
create policy "Users can manage authorized senders" on public.authorized_senders
  for all using (auth.uid() = user_id);

-- FUNCTIONS & TRIGGERS

-- Function to update 'updated_at' column
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for email_accounts
create trigger set_updated_at_email_accounts
  before update on public.email_accounts
  for each row execute procedure public.handle_updated_at();

