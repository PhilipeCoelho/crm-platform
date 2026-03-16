CREATE TABLE IF NOT EXISTS unsubscribed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (though backend uses service or anon with policy)
ALTER TABLE unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated/anon if needed, or simply insert
CREATE POLICY "Allow public inserts to unsubscribed_emails"
ON unsubscribed_emails FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow authenticated read unsubscribed_emails"
ON unsubscribed_emails FOR SELECT
TO authenticated
USING (true);

-- Also we might need service role to just write from backend without RLS issues. Backend uses anon key, let's allow anon to select/insert.
CREATE POLICY "Allow anon read/insert unsubscribed_emails"
ON unsubscribed_emails FOR ALL
TO anon
USING (true)
WITH CHECK (true);
