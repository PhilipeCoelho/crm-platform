-- MIGRATION: CREATE COMMERCIAL INSIGHTS TRENDS FUNCTION
-- This function aggregates commercial insights from insights_comerciais natively in PostgreSQL.

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
    
    -- 1. Top 10 subcategories by category (dor, objecao, barreira_acesso) in current period
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

    RETURN jsonb_build_object(
        'total_active_deals', v_total_active_deals,
        'top_subcategories', COALESCE(v_top_subcategories, '{}'::jsonb),
        'tag_counts', COALESCE(v_tag_counts, '[]'::jsonb),
        'win_loss_reasons', COALESCE(v_win_loss_reasons, '{}'::jsonb),
        'pending_counts', v_pending_counts
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- MIGRATION: CREATE CONTENT SIGNALS TRENDS FUNCTION (v2 - fixed GROUP BY / ORDER BY)
-- This function aggregates insights_comerciais by content_signal for the "Inteligência de Conteúdo" tab.

CREATE OR REPLACE FUNCTION public.get_content_signals_trends(p_days integer)
RETURNS jsonb AS $$
DECLARE
    v_current_start timestamptz;
    v_prev_start    timestamptz;
    v_user_id       uuid;
    v_result        jsonb;
BEGIN
    -- Auth guard: same pattern as get_commercial_insights_trends
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    v_current_start := now() - (p_days || ' days')::interval;
    v_prev_start    := now() - (2 * p_days || ' days')::interval;

    WITH current_signals AS (
        SELECT
            ic.content_signal,
            count(*)::int                                                 AS current_total,
            -- pick most common categoria via correlated subquery
            (
                SELECT ic2.categoria
                FROM public.insights_comerciais ic2
                WHERE ic2.user_id        = v_user_id
                  AND ic2.criado_em     >= v_current_start
                  AND ic2.content_signal = ic.content_signal
                GROUP BY ic2.categoria
                ORDER BY count(*) DESC
                LIMIT 1
            )                                                            AS common_categoria,
            -- collect up to 3 distinct texto_origem examples as jsonb array
            (
                SELECT jsonb_agg(ex ORDER BY ex)
                FROM (
                    SELECT DISTINCT ic3.texto_origem AS ex
                    FROM public.insights_comerciais ic3
                    WHERE ic3.user_id        = v_user_id
                      AND ic3.criado_em     >= v_current_start
                      AND ic3.content_signal = ic.content_signal
                    LIMIT 3
                ) sub
            )                                                            AS examples,
            -- collect most-frequent tags as a simple text array (jsonb)
            (
                SELECT COALESCE(jsonb_agg(tg ORDER BY cnt DESC), '[]'::jsonb)
                FROM (
                    SELECT t AS tg, count(*) AS cnt
                    FROM public.insights_comerciais ic4,
                         unnest(ic4.tags_tematicas) t
                    WHERE ic4.user_id        = v_user_id
                      AND ic4.criado_em     >= v_current_start
                      AND ic4.content_signal = ic.content_signal
                    GROUP BY t
                    ORDER BY cnt DESC
                    LIMIT 5
                ) tag_sub
            )                                                            AS common_tags
        FROM public.insights_comerciais ic
        WHERE ic.user_id       = v_user_id
          AND ic.criado_em    >= v_current_start
          AND ic.content_signal IS NOT NULL
          AND ic.content_signal <> ''
        GROUP BY ic.content_signal
    ),
    prev_signals AS (
        SELECT
            content_signal,
            count(*)::int AS prev_total
        FROM public.insights_comerciais
        WHERE user_id        = v_user_id
          AND criado_em     >= v_prev_start
          AND criado_em      < v_current_start
          AND content_signal IS NOT NULL
          AND content_signal <> ''
        GROUP BY content_signal
    ),
    -- Join and build the final rows before aggregating
    -- (needed so ORDER BY can reference the column directly, not an alias)
    joined AS (
        SELECT
            c.content_signal,
            c.current_total,
            COALESCE(p.prev_total, 0)          AS prev_total,
            COALESCE(c.examples, '[]'::jsonb)  AS examples,
            COALESCE(c.common_categoria, 'neutro') AS common_categoria,
            COALESCE(c.common_tags, '[]'::jsonb) AS common_tags
        FROM current_signals c
        LEFT JOIN prev_signals p ON c.content_signal = p.content_signal
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'content_signal',   j.content_signal,
                'current_total',    j.current_total,
                'prev_total',       j.prev_total,
                'examples',         j.examples,
                'common_categoria', j.common_categoria,
                'common_tags',      j.common_tags
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

-- Reload schema cache to register both functions
NOTIFY pgrst, 'reload schema';

