-- ==============================================================================
-- MIGRATION: ENHANCED COMMERCIAL INSIGHTS & CONTENT SIGNALS TRENDS (V2)
-- Agregações nativas no PostgreSQL com suporte a Tensões, Crenças, Citações e Memória
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_commercial_insights_trends(p_days integer)
RETURNS jsonb AS $$
DECLARE
    v_current_start timestamptz;
    v_prev_start timestamptz;
    v_user_id uuid;
    v_total_active_deals bigint;
    v_top_subcategories jsonb;
    v_tag_counts jsonb;
    v_win_loss_reasons jsonb;
    v_pending_counts jsonb;
    v_top_tensions jsonb;
    v_top_beliefs jsonb;
    v_top_quotes jsonb;
    v_signal_types jsonb;
    v_signal_statuses jsonb;
    v_evidence_stats jsonb;
BEGIN
    -- Get current authenticated user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    v_current_start := now() - (p_days || ' days')::interval;
    v_prev_start := now() - (2 * p_days || ' days')::interval;
    
    -- Total active deals for the user
    SELECT count(*) INTO v_total_active_deals
    FROM public.deals
    WHERE user_id = v_user_id AND status = 'open';
    
    -- 1. Top 10 subcategories by category in current period
    WITH subcat_counts AS (
        SELECT 
            categoria, 
            subcategoria, 
            count(*) as total,
            ROW_NUMBER() OVER(PARTITION BY categoria ORDER BY count(*) DESC) as rn
        FROM public.insights_comerciais
        WHERE user_id = v_user_id 
          AND criado_em >= v_current_start
          AND categoria IN ('dor', 'objecao', 'barreira_acesso')
        GROUP BY categoria, subcategoria
    )
    SELECT jsonb_object_agg(categoria, subcats) INTO v_top_subcategories
    FROM (
        SELECT categoria, jsonb_agg(jsonb_build_object('subcategoria', subcategoria, 'total', total)) as subcats
        FROM subcat_counts
        WHERE rn <= 10
        GROUP BY categoria
    ) s;
    
    -- 2. Tag counts in current and previous period for comparison
    WITH current_tags AS (
        SELECT t as tag, count(*) as total
        FROM public.insights_comerciais,
             unnest(tags_tematicas) t
        WHERE user_id = v_user_id AND criado_em >= v_current_start
        GROUP BY t
    ),
    prev_tags AS (
        SELECT t as tag, count(*) as total
        FROM public.insights_comerciais,
             unnest(tags_tematicas) t
        WHERE user_id = v_user_id AND criado_em >= v_prev_start AND criado_em < v_current_start
        GROUP BY t
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'tag', COALESCE(c.tag, p.tag),
            'current_total', COALESCE(c.total, 0),
            'prev_total', COALESCE(p.total, 0)
        )
    ) INTO v_tag_counts
    FROM current_tags c
    FULL OUTER JOIN prev_tags p ON c.tag = p.tag;

    -- 3. Top 5 win reasons and top 5 lose reasons
    WITH wl_reasons AS (
        SELECT 
            categoria,
            subcategoria,
            count(*) as total,
            array_to_json(array(
                SELECT DISTINCT unnest(tags_tematicas) 
                FROM public.insights_comerciais i2
                WHERE i2.subcategoria = i.subcategoria AND i2.user_id = v_user_id AND i2.criado_em >= v_current_start
            ))::jsonb as tags,
            ROW_NUMBER() OVER(PARTITION BY categoria ORDER BY count(*) DESC) as rn
        FROM public.insights_comerciais i
        WHERE user_id = v_user_id 
          AND criado_em >= v_current_start
          AND categoria IN ('motivo_ganho', 'motivo_perda')
        GROUP BY categoria, subcategoria
    )
    SELECT jsonb_object_agg(categoria, reasons) INTO v_win_loss_reasons
    FROM (
        SELECT categoria, jsonb_agg(jsonb_build_object('subcategoria', subcategoria, 'total', total, 'tags', tags)) as reasons
        FROM wl_reasons
        WHERE rn <= 5
        GROUP BY categoria
    ) r;

    -- 4. Counts of pending review and failed classifications
    SELECT jsonb_build_object(
        'revisar_manualmente', count(*) FILTER (WHERE revisar_manualmente = true),
        'classificacao_falhou', count(*) FILTER (WHERE classificacao_falhou = true)
    ) INTO v_pending_counts
    FROM public.insights_comerciais
    WHERE user_id = v_user_id;

    -- 5. Top Tensões Mapeadas (Radar de Conflitos: Desejo vs Comportamento/Medo)
    WITH tensions_agg AS (
        SELECT 
            tension,
            categoria,
            subcategoria,
            topic,
            count(*) as total,
            count(DISTINCT negocio_id) as unique_deals,
            max(tension_score) as max_tension_score
        FROM public.insights_comerciais
        WHERE user_id = v_user_id 
          AND criado_em >= v_current_start
          AND tension IS NOT NULL 
          AND tension <> ''
        GROUP BY tension, categoria, subcategoria, topic
        ORDER BY count(*) DESC
        LIMIT 10
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'tension', tension,
                'categoria', categoria,
                'subcategoria', subcategoria,
                'topic', topic,
                'total', total,
                'unique_deals', unique_deals,
                'tension_score', COALESCE(max_tension_score, 70)
            )
        ),
        '[]'::jsonb
    ) INTO v_top_tensions
    FROM tensions_agg;

    -- 6. Top Crenças Identificadas (Beliefs & Desired Beliefs)
    WITH beliefs_agg AS (
        SELECT 
            belief,
            desired_belief,
            categoria,
            count(*) as total,
            count(DISTINCT negocio_id) as unique_deals
        FROM public.insights_comerciais
        WHERE user_id = v_user_id 
          AND criado_em >= v_current_start
          AND belief IS NOT NULL 
          AND belief <> ''
        GROUP BY belief, desired_belief, categoria
        ORDER BY count(*) DESC
        LIMIT 10
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'belief', belief,
                'desired_belief', desired_belief,
                'categoria', categoria,
                'total', total,
                'unique_deals', unique_deals
            )
        ),
        '[]'::jsonb
    ) INTO v_top_beliefs
    FROM beliefs_agg;

    -- 7. Top Citações Literais (Voz Real do Lead / quote_original)
    WITH quotes_agg AS (
        SELECT 
            quote_original,
            quote_context,
            categoria,
            subcategoria,
            criado_em
        FROM public.insights_comerciais
        WHERE user_id = v_user_id 
          AND criado_em >= v_current_start
          AND quote_original IS NOT NULL 
          AND quote_original <> ''
        ORDER BY criado_em DESC
        LIMIT 15
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'quote_original', quote_original,
                'quote_context', quote_context,
                'categoria', categoria,
                'subcategoria', subcategoria,
                'criado_em', criado_em
            )
        ),
        '[]'::jsonb
    ) INTO v_top_quotes
    FROM quotes_agg;

    -- 8. Tipos de Sinal & Status
    SELECT COALESCE(
        jsonb_object_agg(COALESCE(signal_type, 'unclassified'), cnt),
        '{}'::jsonb
    ) INTO v_signal_types
    FROM (
        SELECT signal_type, count(*) as cnt
        FROM public.insights_comerciais
        WHERE user_id = v_user_id AND criado_em >= v_current_start
        GROUP BY signal_type
    ) st;

    SELECT COALESCE(
        jsonb_object_agg(COALESCE(signal_status, 'emerging'), cnt),
        '{}'::jsonb
    ) INTO v_signal_statuses
    FROM (
        SELECT signal_status, count(*) as cnt
        FROM public.insights_comerciais
        WHERE user_id = v_user_id AND criado_em >= v_current_start
        GROUP BY signal_status
    ) ss;

    -- 9. Estatísticas Globais de Evidência
    SELECT jsonb_build_object(
        'total_signals', count(*),
        'unique_deals_with_signals', count(DISTINCT negocio_id),
        'avg_specificity', COALESCE(round(avg(specificity_score)), 0),
        'avg_novelty', COALESCE(round(avg(novelty_score)), 0)
    ) INTO v_evidence_stats
    FROM public.insights_comerciais
    WHERE user_id = v_user_id AND criado_em >= v_current_start;

    RETURN jsonb_build_object(
        'total_active_deals', v_total_active_deals,
        'top_subcategories', COALESCE(v_top_subcategories, '{}'::jsonb),
        'tag_counts', COALESCE(v_tag_counts, '[]'::jsonb),
        'win_loss_reasons', COALESCE(v_win_loss_reasons, '{}'::jsonb),
        'pending_counts', v_pending_counts,
        'top_tensions', COALESCE(v_top_tensions, '[]'::jsonb),
        'top_beliefs', COALESCE(v_top_beliefs, '[]'::jsonb),
        'top_quotes', COALESCE(v_top_quotes, '[]'::jsonb),
        'signal_types', COALESCE(v_signal_types, '{}'::jsonb),
        'signal_statuses', COALESCE(v_signal_statuses, '{}'::jsonb),
        'evidence_stats', v_evidence_stats
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ==============================================================================
-- ENHANCED CONTENT SIGNALS TRENDS FUNCTION (v2)
-- Retorna os sinais agregados com suporte a Tópicos, Citações, Tensões e Ângulos
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_content_signals_trends(p_days integer)
RETURNS jsonb AS $$
DECLARE
    v_current_start timestamptz;
    v_prev_start    timestamptz;
    v_user_id       uuid;
    v_result        jsonb;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    v_current_start := now() - (p_days || ' days')::interval;
    v_prev_start    := now() - (2 * p_days || ' days')::interval;

    WITH current_signals AS (
        SELECT
            COALESCE(ic.topic, ic.subcategoria, ic.content_signal)      AS topic_key,
            ic.content_signal,
            count(*)::int                                               AS current_total,
            count(DISTINCT ic.negocio_id)::int                          AS unique_deals,
            -- Categoria mais frequente
            (
                SELECT ic2.categoria
                FROM public.insights_comerciais ic2
                WHERE ic2.user_id = v_user_id
                  AND ic2.criado_em >= v_current_start
                  AND ic2.content_signal = ic.content_signal
                GROUP BY ic2.categoria
                ORDER BY count(*) DESC
                LIMIT 1
            )                                                           AS common_categoria,
            -- Exemplos de texto de origem
            (
                SELECT jsonb_agg(ex ORDER BY ex)
                FROM (
                    SELECT DISTINCT ic3.texto_origem AS ex
                    FROM public.insights_comerciais ic3
                    WHERE ic3.user_id = v_user_id
                      AND ic3.criado_em >= v_current_start
                      AND ic3.content_signal = ic.content_signal
                    LIMIT 3
                ) sub
            )                                                           AS examples,
            -- Citações literais reais (quote_original)
            (
                SELECT jsonb_agg(q ORDER BY q)
                FROM (
                    SELECT DISTINCT ic_q.quote_original AS q
                    FROM public.insights_comerciais ic_q
                    WHERE ic_q.user_id = v_user_id
                      AND ic_q.criado_em >= v_current_start
                      AND ic_q.content_signal = ic.content_signal
                      AND ic_q.quote_original IS NOT NULL
                      AND ic_q.quote_original <> ''
                    LIMIT 3
                ) q_sub
            )                                                           AS quote_examples,
            -- Tensão mais relevante
            (
                SELECT ic_t.tension
                FROM public.insights_comerciais ic_t
                WHERE ic_t.user_id = v_user_id
                  AND ic_t.criado_em >= v_current_start
                  AND ic_t.content_signal = ic.content_signal
                  AND ic_t.tension IS NOT NULL
                  AND ic_t.tension <> ''
                GROUP BY ic_t.tension
                ORDER BY count(*) DESC
                LIMIT 1
            )                                                           AS representative_tension,
            -- Tags mais comuns
            (
                SELECT COALESCE(jsonb_agg(tg ORDER BY cnt DESC), '[]'::jsonb)
                FROM (
                    SELECT t AS tg, count(*) AS cnt
                    FROM public.insights_comerciais ic4,
                         unnest(ic4.tags_tematicas) t
                    WHERE ic4.user_id = v_user_id
                      AND ic4.criado_em >= v_current_start
                      AND ic4.content_signal = ic.content_signal
                    GROUP BY t
                    ORDER BY cnt DESC
                    LIMIT 5
                ) tag_sub
            )                                                           AS common_tags,
            -- Ângulos disponíveis agregados
            (
                SELECT COALESCE(jsonb_agg(DISTINCT ang), '[]'::jsonb)
                FROM public.insights_comerciais ic_ang,
                     unnest(ic_ang.angles_available) ang
                WHERE ic_ang.user_id = v_user_id
                  AND ic_ang.content_signal = ic.content_signal
            )                                                           AS angles_available,
            -- Ângulos já utilizados
            (
                SELECT COALESCE(jsonb_agg(DISTINCT ang_u), '[]'::jsonb)
                FROM public.insights_comerciais ic_u,
                     unnest(ic_u.angles_used) ang_u
                WHERE ic_u.user_id = v_user_id
                  AND ic_u.content_signal = ic.content_signal
            )                                                           AS angles_used,
            round(COALESCE(avg(ic.content_saturation_score), 0))::int   AS content_saturation_score,
            round(COALESCE(avg(ic.novelty_score), 50))::int             AS avg_novelty_score,
            COALESCE(max(ic.signal_status), 'emerging')                 AS signal_status
        FROM public.insights_comerciais ic
        WHERE ic.user_id = v_user_id
          AND ic.criado_em >= v_current_start
          AND ic.content_signal IS NOT NULL
          AND ic.content_signal <> ''
        GROUP BY COALESCE(ic.topic, ic.subcategoria, ic.content_signal), ic.content_signal
    ),
    prev_signals AS (
        SELECT
            content_signal,
            count(*)::int AS prev_total
        FROM public.insights_comerciais
        WHERE user_id = v_user_id
          AND criado_em >= v_prev_start
          AND criado_em < v_current_start
          AND content_signal IS NOT NULL
          AND content_signal <> ''
        GROUP BY content_signal
    ),
    joined AS (
        SELECT
            c.topic_key,
            c.content_signal,
            c.current_total,
            COALESCE(p.prev_total, 0)                  AS prev_total,
            c.unique_deals,
            COALESCE(c.examples, '[]'::jsonb)          AS examples,
            COALESCE(c.quote_examples, '[]'::jsonb)    AS quote_examples,
            c.representative_tension,
            COALESCE(c.common_categoria, 'neutro')     AS common_categoria,
            COALESCE(c.common_tags, '[]'::jsonb)       AS common_tags,
            COALESCE(c.angles_available, '[]'::jsonb)  AS angles_available,
            COALESCE(c.angles_used, '[]'::jsonb)       AS angles_used,
            c.content_saturation_score,
            c.avg_novelty_score,
            c.signal_status
        FROM current_signals c
        LEFT JOIN prev_signals p ON c.content_signal = p.content_signal
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'topic',                     j.topic_key,
                'content_signal',            j.content_signal,
                'current_total',             j.current_total,
                'prev_total',                j.prev_total,
                'unique_deals',              j.unique_deals,
                'examples',                  j.examples,
                'quote_examples',            j.quote_examples,
                'tension',                   j.representative_tension,
                'common_categoria',          j.common_categoria,
                'common_tags',               j.common_tags,
                'angles_available',          j.angles_available,
                'angles_used',               j.angles_used,
                'content_saturation_score',  j.content_saturation_score,
                'novelty_score',             j.avg_novelty_score,
                'signal_status',             j.signal_status
            )
            ORDER BY j.current_total DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM joined j;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

NOTIFY pgrst, 'reload schema';
