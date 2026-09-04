-- Update the check constraint on deal_logs to allow the new 'brevo_campaign' event type.
ALTER TABLE public.deal_logs DROP CONSTRAINT IF EXISTS deal_logs_log_type_check;
ALTER TABLE public.deal_logs ADD CONSTRAINT deal_logs_log_type_check CHECK (log_type IN ('activity_note', 'system', 'manual_note', 'brevo_campaign'));


-- Function to update Brevo campaign interactions inside deal_logs securely.
CREATE OR REPLACE FUNCTION public.update_brevo_campaign_log(
    p_email TEXT,
    p_campaign_id INT,
    p_campaign_name TEXT,
    p_event TEXT,
    p_url TEXT,
    p_event_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS for Brevo Webhook execution
AS $$
DECLARE
    v_contact_id UUID;
    v_deal_id UUID;
    v_user_id UUID;
    v_log_id UUID;
    v_existing_content JSONB;
    v_updated_content JSONB;
    v_clicked_links JSONB := '[]'::JSONB;
    v_link_found BOOLEAN := FALSE;
    v_link_item JSONB;
    v_new_link_list JSONB := '[]'::JSONB;
    v_clean_email TEXT;
BEGIN
    -- 1. Normalize Email
    v_clean_email := lower(trim(p_email));
    
    -- 2. Find Contact (match lower email)
    SELECT id INTO v_contact_id 
    FROM public.contacts 
    WHERE lower(trim(email)) = v_clean_email 
    LIMIT 1;
    
    IF v_contact_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Contact not found');
    END IF;
    
    -- 3. Find Active Deal for Contact
    SELECT id, user_id INTO v_deal_id, v_user_id 
    FROM public.deals 
    WHERE contact_id = v_contact_id AND status = 'open'
    LIMIT 1;
    
    IF v_deal_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active deal found');
    END IF;
    
    -- 4. Find Existing Campaign Log
    SELECT id, content::JSONB INTO v_log_id, v_existing_content 
    FROM public.deal_logs 
    WHERE deal_id = v_deal_id AND log_type = 'brevo_campaign' AND (content::JSONB->>'campaignId')::INT = p_campaign_id
    LIMIT 1;
    
    IF v_log_id IS NOT NULL THEN
        -- Update existing JSON content
        v_updated_content := v_existing_content;
        
        -- Event logic
        IF p_event = 'opened' OR p_event = 'unique_opened' THEN
            v_updated_content := jsonb_set(v_updated_content, '{opensCount}', to_jsonb((COALESCE((v_updated_content->>'opensCount')::INT, 0) + 1)));
            IF v_updated_content->>'firstOpenedAt' IS NULL THEN
                v_updated_content := jsonb_set(v_updated_content, '{firstOpenedAt}', to_jsonb(p_event_date));
            END IF;
            v_updated_content := jsonb_set(v_updated_content, '{lastOpenedAt}', to_jsonb(p_event_date));
            
        ELSIF p_event = 'click' THEN
            v_updated_content := jsonb_set(v_updated_content, '{clicksCount}', to_jsonb((COALESCE((v_updated_content->>'clicksCount')::INT, 0) + 1)));
            
            -- Update clicked links
            v_clicked_links := COALESCE(v_updated_content->'clickedLinks', '[]'::JSONB);
            
            -- Loop over links to find if url exists
            FOR v_link_item IN SELECT * FROM jsonb_array_elements(v_clicked_links) LOOP
                IF v_link_item->>'url' = p_url THEN
                    v_link_found := TRUE;
                    v_new_link_list := v_new_link_list || jsonb_build_object(
                        'url', p_url,
                        'anchor', v_link_item->>'anchor',
                        'clicks', (v_link_item->>'clicks')::INT + 1,
                        'lastClickedAt', p_event_date
                    );
                ELSE
                    v_new_link_list := v_new_link_list || v_link_item;
                END IF;
            END LOOP;
            
            IF NOT v_link_found THEN
                -- Add new link
                v_new_link_list := v_new_link_list || jsonb_build_object(
                    'url', p_url,
                    'anchor', COALESCE(split_part(p_url, '://', 2), p_url),
                    'clicks', 1,
                    'lastClickedAt', p_event_date
                );
            END IF;
            
            v_updated_content := jsonb_set(v_updated_content, '{clickedLinks}', v_new_link_list);
            
        ELSIF p_event = 'invalid_email' OR p_event = 'bounce' OR p_event = 'hard_bounce' THEN
            v_updated_content := jsonb_set(v_updated_content, '{bounce}', 'true'::JSONB);
            v_updated_content := jsonb_set(v_updated_content, '{deliveryStatus}', '"bounce"'::JSONB);
            
        ELSIF p_event = 'spam' THEN
            v_updated_content := jsonb_set(v_updated_content, '{spam}', 'true'::JSONB);
            
        ELSIF p_event = 'unsubscribed' THEN
            v_updated_content := jsonb_set(v_updated_content, '{unsubscribed}', 'true'::JSONB);
        END IF;
        
        v_updated_content := jsonb_set(v_updated_content, '{updatedAt}', to_jsonb(p_event_date));
        
        UPDATE public.deal_logs 
        SET content = v_updated_content::TEXT 
        WHERE id = v_log_id;
        
        RETURN jsonb_build_object('success', true, 'action', 'updated', 'log_id', v_log_id);
    ELSE
        -- Create new JSON content
        v_updated_content := jsonb_build_object(
            'type', 'brevo_campaign',
            'campaignName', p_campaign_name,
            'campaignId', p_campaign_id,
            'sentAt', p_event_date,
            'deliveryStatus', CASE WHEN p_event = 'bounce' OR p_event = 'hard_bounce' OR p_event = 'invalid_email' THEN 'bounce' ELSE 'delivered' END,
            'opensCount', CASE WHEN p_event = 'opened' OR p_event = 'unique_opened' THEN 1 ELSE 0 END,
            'firstOpenedAt', CASE WHEN p_event = 'opened' OR p_event = 'unique_opened' THEN p_event_date ELSE NULL END,
            'lastOpenedAt', CASE WHEN p_event = 'opened' OR p_event = 'unique_opened' THEN p_event_date ELSE NULL END,
            'clicksCount', CASE WHEN p_event = 'click' THEN 1 ELSE 0 END,
            'clickedLinks', CASE WHEN p_event = 'click' THEN jsonb_build_array(jsonb_build_object(
                'url', p_url,
                'anchor', COALESCE(split_part(p_url, '://', 2), p_url),
                'clicks', 1,
                'lastClickedAt', p_event_date
            )) ELSE '[]'::JSONB END,
            'bounce', CASE WHEN p_event = 'bounce' OR p_event = 'hard_bounce' OR p_event = 'invalid_email' THEN true ELSE false END,
            'spam', CASE WHEN p_event = 'spam' THEN true ELSE false END,
            'unsubscribed', CASE WHEN p_event = 'unsubscribed' THEN true ELSE false END,
            'updatedAt', p_event_date
        );
        
        INSERT INTO public.deal_logs (deal_id, log_type, content, created_by, created_at)
        VALUES (v_deal_id, 'brevo_campaign', v_updated_content::TEXT, v_user_id, p_event_date::TIMESTAMPTZ)
        RETURNING id INTO v_log_id;
        
        RETURN jsonb_build_object('success', true, 'action', 'created', 'log_id', v_log_id);
    END IF;
END;
$$;


-- Function to upsert aggregated campaign history logs from Brevo API.
CREATE OR REPLACE FUNCTION public.upsert_aggregated_brevo_campaign_log(
    p_email TEXT,
    p_campaign_id INT,
    p_campaign_name TEXT,
    p_log_content JSONB,
    p_event_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS for admin execution
AS $$
DECLARE
    v_contact_id UUID;
    v_deal_id UUID;
    v_user_id UUID;
    v_log_id UUID;
    v_clean_email TEXT;
BEGIN
    -- 1. Normalize Email
    v_clean_email := lower(trim(p_email));
    
    -- 2. Find Contact (match lower email)
    SELECT id INTO v_contact_id 
    FROM public.contacts 
    WHERE lower(trim(email)) = v_clean_email 
    LIMIT 1;
    
    IF v_contact_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Contact not found');
    END IF;
    
    -- 3. Find Active Deal for Contact
    SELECT id, user_id INTO v_deal_id, v_user_id 
    FROM public.deals 
    WHERE contact_id = v_contact_id AND status = 'open'
    LIMIT 1;
    
    IF v_deal_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active deal found');
    END IF;
    
    -- 4. Find Existing Campaign Log
    SELECT id INTO v_log_id 
    FROM public.deal_logs 
    WHERE deal_id = v_deal_id AND log_type = 'brevo_campaign' AND (content::JSONB->>'campaignId')::INT = p_campaign_id
    LIMIT 1;
    
    IF v_log_id IS NOT NULL THEN
        UPDATE public.deal_logs 
        SET content = p_log_content::TEXT 
        WHERE id = v_log_id;
        
        RETURN jsonb_build_object('success', true, 'action', 'updated', 'log_id', v_log_id);
    ELSE
        INSERT INTO public.deal_logs (deal_id, log_type, content, created_by, created_at)
        VALUES (v_deal_id, 'brevo_campaign', p_log_content::TEXT, v_user_id, p_event_date::TIMESTAMPTZ)
        RETURNING id INTO v_log_id;
        
        RETURN jsonb_build_object('success', true, 'action', 'created', 'log_id', v_log_id);
    END IF;
END;
$$;


-- Function to get contacts and deals for a user bypassing RLS.
CREATE OR REPLACE FUNCTION public.get_contacts_and_active_deals_for_sync(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contacts JSONB;
    v_deals JSONB;
BEGIN
    SELECT json_agg(t) INTO v_contacts FROM (SELECT id, email FROM public.contacts WHERE user_id = p_user_id) t;
    SELECT json_agg(t) INTO v_deals FROM (SELECT contact_id FROM public.deals WHERE user_id = p_user_id AND status = 'open') t;
    RETURN jsonb_build_object(
        'contacts', COALESCE(v_contacts, '[]'::jsonb), 
        'deals', COALESCE(v_deals, '[]'::jsonb)
    );
END;
$$;


-- Function to save sync results for contacts, profiles and logs bypassing RLS.
CREATE OR REPLACE FUNCTION public.save_brevo_sync_results(
    p_user_id UUID,
    p_synced_ids UUID[],
    p_not_synced_ids UUID[],
    p_not_eligible_ids UUID[],
    p_log_synced INT,
    p_log_not_synced INT,
    p_log_ignored INT,
    p_duration INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Update Contacts status
    IF array_length(p_synced_ids, 1) > 0 THEN
        UPDATE public.contacts 
        SET brevo_sync_status = 'sincronizado', brevo_status = true 
        WHERE id = ANY(p_synced_ids);
    END IF;

    IF array_length(p_not_synced_ids, 1) > 0 THEN
        UPDATE public.contacts 
        SET brevo_sync_status = 'nao_sincronizado', brevo_status = false 
        WHERE id = ANY(p_not_synced_ids);
    END IF;

    IF array_length(p_not_eligible_ids, 1) > 0 THEN
        UPDATE public.contacts 
        SET brevo_sync_status = 'nao_elegivel', brevo_status = false 
        WHERE id = ANY(p_not_eligible_ids);
    END IF;

    -- Update Profile
    UPDATE public.profiles 
    SET brevo_last_sync_at = v_now 
    WHERE id = p_user_id;

    -- Insert Sync Log
    INSERT INTO public.brevo_sync_logs (user_id, sync_at, synced_count, not_synced_count, ignored_count, duration_ms)
    VALUES (p_user_id, v_now, p_log_synced, p_log_not_synced, p_log_ignored, p_duration);
END;
$$;


-- Function to get all profiles with a Brevo API key bypassing RLS.
CREATE OR REPLACE FUNCTION public.get_profiles_with_brevo_key()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profiles JSONB;
BEGIN
    SELECT json_agg(t) INTO v_profiles 
    FROM (
        SELECT id, name, email, brevo_api_key 
        FROM public.profiles 
        WHERE brevo_api_key IS NOT NULL AND brevo_api_key <> ''
    ) t;
    RETURN COALESCE(v_profiles, '[]'::jsonb);
END;
$$;
