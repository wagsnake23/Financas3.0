


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'conferente'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."receita_status" AS ENUM (
    'Prevista',
    'Pendente',
    'Recebida',
    'Cancelada'
);


ALTER TYPE "public"."receita_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_recurring_entries"("p_user_id" "uuid", "p_transaction_type" "text", "p_master_id" "uuid", "p_first_occurrence_date" "date", "p_monthly_amount" numeric, "p_category_id" "text", "p_description" "text", "p_status" "public"."receita_status", "p_recurrence_day" integer, "p_total_installments" integer, "p_forma_pagamento" "text" DEFAULT NULL::"text", "p_cartao_id" "uuid" DEFAULT NULL::"uuid", "p_tipo_pagamento" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_day_to_use integer;
    v_installment_date date;
    v_existing_id uuid;
    v_real_total integer;
BEGIN
    ------------------------------------------------------------------
    -- 🔹 Blindagem: parcelado NUNCA pode virar 120
    ------------------------------------------------------------------
    IF p_transaction_type = 'expense' AND p_tipo_pagamento = 'parcelado' THEN
        SELECT numero_parcelas
        INTO v_real_total
        FROM despesas
        WHERE id = p_master_id;

        IF v_real_total IS NOT NULL THEN
            p_total_installments := v_real_total;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- Dia da recorrência
    ------------------------------------------------------------------
    v_day_to_use := COALESCE(
        p_recurrence_day,
        EXTRACT(DAY FROM p_first_occurrence_date)::integer
    );

    ------------------------------------------------------------------
    -- Loop de geração
    ------------------------------------------------------------------
    FOR i IN 0..(p_total_installments - 1) LOOP
        v_installment_date := (p_first_occurrence_date + (i || ' months')::INTERVAL)::date;

        BEGIN
            v_installment_date := make_date(
                EXTRACT(YEAR FROM v_installment_date)::int,
                EXTRACT(MONTH FROM v_installment_date)::int,
                v_day_to_use
            );
        EXCEPTION WHEN OTHERS THEN
            v_installment_date :=
                (date_trunc('month', v_installment_date)
                 + interval '1 month - 1 day')::date;
        END;

        ------------------------------------------------------------------
        -- RECEITAS (mantido)
        ------------------------------------------------------------------
        IF p_transaction_type = 'income' THEN
            SELECT id INTO v_existing_id
            FROM public.receitas
            WHERE recurrence_id = p_master_id
              AND data = v_installment_date
              AND user_id = p_user_id;

            IF v_existing_id IS NULL THEN
                INSERT INTO public.receitas (
                    user_id,
                    tipo_receita_id,
                    valor,
                    data,
                    descricao,
                    status,
                    is_recurring_master,
                    recurrence_id,
                    recurrence_day
                )
                VALUES (
                    p_user_id,
                    p_category_id,
                    p_monthly_amount,
                    v_installment_date,
                    p_description,
                    p_status,
                    FALSE,
                    p_master_id,
                    v_day_to_use
                );
            END IF;

        ------------------------------------------------------------------
        -- DESPESAS PARCELADAS / FIXAS
        ------------------------------------------------------------------
        ELSIF p_transaction_type = 'expense' THEN
            SELECT id INTO v_existing_id
            FROM public.despesas_parcelas
            WHERE despesa_id = p_master_id
              AND numero_parcela = i + 1;

            IF v_existing_id IS NULL THEN
                INSERT INTO public.despesas_parcelas (
                    despesa_id,
                    numero_parcela,
                    valor_parcela,
                    vencimento,
                    pago,
                    data_pagamento
                )
                VALUES (
                    p_master_id,
                    i + 1,
                    p_monthly_amount,
                    v_installment_date,
                    FALSE,
                    NULL
                );
            ELSE
                UPDATE public.despesas_parcelas
                SET vencimento = v_installment_date,
                    valor_parcela = p_monthly_amount
                WHERE id = v_existing_id;
            END IF;
        END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 🔹 Atualizar o master de despesas corretamente
    ------------------------------------------------------------------
    IF p_transaction_type = 'expense' THEN
        UPDATE public.despesas
        SET
            valor_total = (SELECT SUM(valor_parcela) FROM public.despesas_parcelas WHERE despesa_id = p_master_id),
            numero_parcelas = p_total_installments,
            categoria_id = p_category_id,
            descricao = p_description,
            forma_pagamento = p_forma_pagamento,
            cartao_id = p_cartao_id,
            tipo_pagamento = p_tipo_pagamento
        WHERE id = p_master_id AND user_id = p_user_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."generate_recurring_entries"("p_user_id" "uuid", "p_transaction_type" "text", "p_master_id" "uuid", "p_first_occurrence_date" "date", "p_monthly_amount" numeric, "p_category_id" "text", "p_description" "text", "p_status" "public"."receita_status", "p_recurrence_day" integer, "p_total_installments" integer, "p_forma_pagamento" "text", "p_cartao_id" "uuid", "p_tipo_pagamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
    -- Cria o perfil
    INSERT INTO public.profiles (
        id,
        nome
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Cria a role padrão
    INSERT INTO public.user_roles (
        user_id,
        role
    )
    VALUES (
        NEW.id,
        'conferente'
    )
    ON CONFLICT DO NOTHING;

    -- Cria a assinatura Trial
    INSERT INTO public.subscriptions (
        user_id,
        subscription_type,
        subscription_status,
        expires_at
    )
    VALUES (
        NEW.id,
        'trial',
        'active',
        NOW() + INTERVAL '30 days'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_audit"("p_user_id" "uuid", "p_action_type" "text", "p_table_name" "text", "p_record_id" "text", "p_old_data" "jsonb" DEFAULT NULL::"jsonb", "p_new_data" "jsonb" DEFAULT NULL::"jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data, notes)
    VALUES (p_user_id, p_action_type, p_table_name, p_record_id, p_old_data, p_new_data, p_notes);
END;
$$;


ALTER FUNCTION "public"."rpc_audit"("p_user_id" "uuid", "p_action_type" "text", "p_table_name" "text", "p_record_id" "text", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shopping_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shopping_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "notes" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cartoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "banco" "text" NOT NULL,
    "ultimos_digitos" "text" NOT NULL,
    "dia_fechamento" integer NOT NULL,
    "dia_vencimento" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_principal" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cartoes_dia_fechamento_check" CHECK ((("dia_fechamento" >= 1) AND ("dia_fechamento" <= 31))),
    CONSTRAINT "cartoes_dia_vencimento_check" CHECK ((("dia_vencimento" >= 1) AND ("dia_vencimento" <= 31)))
);


ALTER TABLE "public"."cartoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "icone" "text" NOT NULL,
    "cor" "text" NOT NULL,
    "forma_pagamento" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_tributacao" "text",
    CONSTRAINT "categorias_parent_required_for_sub" CHECK ((("parent_id" IS NULL) OR ("parent_id" IS NOT NULL))),
    CONSTRAINT "check_tipo_tributacao" CHECK (("tipo_tributacao" = ANY (ARRAY['regressivo'::"text", 'isento'::"text"])))
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contas_bancarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "banco" "text" NOT NULL,
    "agencia" "text",
    "numero" "text",
    "tipo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contas_bancarias_tipo_check" CHECK (("tipo" = ANY (ARRAY['corrente'::"text", 'poupanca'::"text"])))
);


ALTER TABLE "public"."contas_bancarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "categoria_id" "text",
    "forma_pagamento" "text" NOT NULL,
    "tipo_pagamento" "text" NOT NULL,
    "cartao_id" "uuid",
    "valor_total" numeric(10,2) NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "numero_parcelas" integer DEFAULT 1 NOT NULL,
    "is_recurring_master" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "despesas_forma_pagamento_check" CHECK (("forma_pagamento" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'cartao'::"text"]))),
    CONSTRAINT "despesas_tipo_pagamento_check" CHECK (("tipo_pagamento" = ANY (ARRAY['avista'::"text", 'parcelado'::"text", 'fixo'::"text"])))
);


ALTER TABLE "public"."despesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despesas_parcelas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "despesa_id" "uuid" NOT NULL,
    "numero_parcela" integer NOT NULL,
    "valor_parcela" numeric(10,2) NOT NULL,
    "vencimento" "date" NOT NULL,
    "pago" boolean DEFAULT false,
    "data_pagamento" timestamp without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."despesas_parcelas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."indexadores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "taxa_anual" numeric(10,4),
    "data_inicio" "date" NOT NULL,
    "taxa_diaria" numeric(12,10),
    "taxa_mensal" numeric(10,6),
    "periodicidade" "text",
    CONSTRAINT "check_tipo_indexador" CHECK (("tipo" = ANY (ARRAY['CDI'::"text", 'IPCA'::"text"])))
);


ALTER TABLE "public"."indexadores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "data" "date" NOT NULL,
    "tipo_rentabilidade" "text",
    "indexador" "text",
    "percentual_indexador" numeric,
    "taxa_fixa" numeric,
    "origem_investimento" "text" NOT NULL,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "data_resgate" timestamp with time zone,
    CONSTRAINT "check_indexador" CHECK (("indexador" = ANY (ARRAY['CDI'::"text", 'IPCA'::"text"]))),
    CONSTRAINT "check_tipo_rentabilidade" CHECK (("tipo_rentabilidade" = ANY (ARRAY['fixo'::"text", 'indexado'::"text"]))),
    CONSTRAINT "investimentos_origem_check" CHECK (("origem_investimento" = ANY (ARRAY['saldo_atual'::"text", 'caixa_externo'::"text"]))),
    CONSTRAINT "status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'resgatado'::"text"])))
);


ALTER TABLE "public"."investimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "categoria_id" "text" NOT NULL,
    "valor_objetivo" numeric NOT NULL,
    "valor_mensal" numeric NOT NULL,
    "data_limite" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "metas_valor_mensal_check" CHECK (("valor_mensal" > (0)::numeric)),
    CONSTRAINT "metas_valor_objetivo_check" CHECK (("valor_objetivo" > (0)::numeric))
);


ALTER TABLE "public"."metas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nfce_cnpj_categoria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cnpj" "text" NOT NULL,
    "estabelecimento" "text",
    "categoria_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nfce_cnpj_categoria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nfce_compras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chave_acesso" "text" NOT NULL,
    "url_nfce" "text",
    "estabelecimento" "text",
    "cnpj" "text",
    "data_compra" timestamp with time zone,
    "valor_total" numeric(12,2),
    "forma_pagamento" "text",
    "numero_parcelas" integer,
    "raw_html" "text",
    "status_importacao" "text" DEFAULT 'pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "despesa_id" "uuid"
);


ALTER TABLE "public"."nfce_compras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nfce_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compra_id" "uuid" NOT NULL,
    "descricao" "text",
    "quantidade" numeric(12,3),
    "unidade" "text",
    "valor_unitario" numeric(12,2),
    "valor_total" numeric(12,2),
    "codigo_barras" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nfce_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orcamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "categoria_id" "text" NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "tipo_planejamento" character varying(20) DEFAULT 'valor'::character varying NOT NULL,
    "valor_planejado" numeric(10,2) DEFAULT 0 NOT NULL,
    "percentual_planejado" numeric(5,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_percentual_planejado" CHECK ((("percentual_planejado" >= (0)::numeric) AND ("percentual_planejado" <= (100)::numeric))),
    CONSTRAINT "check_tipo_planejamento" CHECK ((("tipo_planejamento")::"text" = ANY ((ARRAY['valor'::character varying, 'percentual'::character varying])::"text"[]))),
    CONSTRAINT "check_valor_planejado" CHECK (("valor_planejado" >= (0)::numeric))
);


ALTER TABLE "public"."orcamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar" "text" DEFAULT '😎'::"text" NOT NULL,
    "apelido" "text",
    "saldo_ajuste" numeric(14,2) DEFAULT 0 NOT NULL,
    "saldo_ajuste_updated_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receitas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo_receita_id" "text",
    "valor" numeric(10,2) NOT NULL,
    "data" "date" NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."receita_status" DEFAULT 'Pendente'::"public"."receita_status" NOT NULL,
    "is_recurring_master" boolean DEFAULT false,
    "recurrence_id" "uuid",
    "recurrence_day" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receitas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receitas_ocorrencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "receita_id" "uuid" NOT NULL,
    "numero_ocorrencia" integer NOT NULL,
    "valor_ocorrencia" numeric NOT NULL,
    "data_ocorrencia" "date" NOT NULL,
    "status" "public"."receita_status" DEFAULT 'Pendente'::"public"."receita_status" NOT NULL,
    "data_atualizacao_status" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receitas_ocorrencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopping_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product" "text",
    "status" boolean DEFAULT false,
    "date" "text",
    "order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."shopping_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "billing_type" "text" NOT NULL,
    "duration_days" integer,
    "has_expiration" boolean DEFAULT true NOT NULL,
    "is_lifetime" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "is_recommended" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "badge_color" "text",
    "badge_text" "text",
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checkout_title" "text",
    "checkout_description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "subscription_plans_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['free'::"text", 'monthly'::"text", 'yearly'::"text", 'lifetime'::"text"]))),
    CONSTRAINT "subscription_plans_code_check" CHECK (("code" = ANY (ARRAY['trial'::"text", 'premium_monthly'::"text", 'premium_yearly'::"text", 'lifetime'::"text"]))),
    CONSTRAINT "subscription_plans_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_type" "text" NOT NULL,
    "subscription_status" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_payment_at" timestamp with time zone,
    "mercado_pago_preference_id" "text",
    "mercado_pago_payment_id" "text",
    "payment_status" "text",
    "payment_method" "text",
    "paid_at" timestamp with time zone,
    "payment_amount" numeric(10,2),
    "payment_currency" "text" DEFAULT 'BRL'::"text",
    CONSTRAINT "subscriptions_payment_status_check" CHECK ((("payment_status" IS NULL) OR ("payment_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'authorized'::"text", 'in_process'::"text", 'in_mediation'::"text", 'rejected'::"text", 'cancelled'::"text", 'refunded'::"text", 'charged_back'::"text"])))),
    CONSTRAINT "subscriptions_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'expired'::"text", 'blocked'::"text"]))),
    CONSTRAINT "subscriptions_subscription_type_check" CHECK (("subscription_type" = ANY (ARRAY['trial'::"text", 'premium_monthly'::"text", 'premium_yearly'::"text", 'lifetime'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_gastos_por_categoria" WITH ("security_invoker"='on') AS
 SELECT "c_pai"."id" AS "categoria_id",
    "c_pai"."nome" AS "categoria",
    "sum"("d"."valor_total") AS "total",
    "d"."user_id"
   FROM (("public"."despesas" "d"
     JOIN "public"."categorias" "c_filha" ON (("c_filha"."id" = "d"."categoria_id")))
     JOIN "public"."categorias" "c_pai" ON (("c_pai"."id" = "c_filha"."parent_id")))
  GROUP BY "c_pai"."id", "c_pai"."nome", "d"."user_id";


ALTER VIEW "public"."vw_gastos_por_categoria" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contas_bancarias"
    ADD CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despesas_parcelas"
    ADD CONSTRAINT "despesas_parcelas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."indexadores"
    ADD CONSTRAINT "indexadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investimentos"
    ADD CONSTRAINT "investimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfce_cnpj_categoria"
    ADD CONSTRAINT "nfce_cnpj_categoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfce_compras"
    ADD CONSTRAINT "nfce_compras_chave_acesso_key" UNIQUE ("chave_acesso");



ALTER TABLE ONLY "public"."nfce_compras"
    ADD CONSTRAINT "nfce_compras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfce_itens"
    ADD CONSTRAINT "nfce_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_user_id_categoria_id_mes_ano_key" UNIQUE ("user_id", "categoria_id", "mes_ano");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receitas_ocorrencias"
    ADD CONSTRAINT "receitas_ocorrencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receitas_ocorrencias"
    ADD CONSTRAINT "receitas_ocorrencias_receita_id_numero_ocorrencia_key" UNIQUE ("receita_id", "numero_ocorrencia");



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_items"
    ADD CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE UNIQUE INDEX "idx_cartoes_principal_por_usuario" ON "public"."cartoes" USING "btree" ("user_id") WHERE ("is_principal" = true);



CREATE INDEX "idx_nfce_cnpj_categoria_cnpj" ON "public"."nfce_cnpj_categoria" USING "btree" ("cnpj");



CREATE UNIQUE INDEX "idx_nfce_cnpj_categoria_user_cnpj" ON "public"."nfce_cnpj_categoria" USING "btree" ("user_id", "cnpj");



CREATE INDEX "idx_nfce_compras_data" ON "public"."nfce_compras" USING "btree" ("data_compra");



CREATE INDEX "idx_nfce_compras_despesa_id" ON "public"."nfce_compras" USING "btree" ("despesa_id");



CREATE INDEX "idx_nfce_compras_estabelecimento" ON "public"."nfce_compras" USING "btree" ("estabelecimento");



CREATE INDEX "idx_nfce_itens_compra_id" ON "public"."nfce_itens" USING "btree" ("compra_id");



CREATE INDEX "idx_orcamentos_user_mes" ON "public"."orcamentos" USING "btree" ("user_id", "mes_ano");



CREATE INDEX "idx_receitas_recurrence_id" ON "public"."receitas" USING "btree" ("recurrence_id");



CREATE INDEX "idx_subscription_plans_active" ON "public"."subscription_plans" USING "btree" ("is_active");



CREATE INDEX "idx_subscription_plans_order" ON "public"."subscription_plans" USING "btree" ("display_order");



CREATE INDEX "idx_subscription_plans_visible" ON "public"."subscription_plans" USING "btree" ("is_visible");



CREATE INDEX "idx_subscriptions_mp_payment" ON "public"."subscriptions" USING "btree" ("mercado_pago_payment_id");



CREATE INDEX "idx_subscriptions_mp_preference" ON "public"."subscriptions" USING "btree" ("mercado_pago_preference_id");



CREATE INDEX "idx_subscriptions_payment_status" ON "public"."subscriptions" USING "btree" ("payment_status");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("subscription_status");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_unique_cdi_dia" ON "public"."indexadores" USING "btree" ("tipo", "data_inicio");



CREATE OR REPLACE TRIGGER "trg_update_shopping_items_updated_at" BEFORE UPDATE ON "public"."shopping_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_shopping_items_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_updated_at_despesas" BEFORE UPDATE ON "public"."despesas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_updated_at_despesas_parcelas" BEFORE UPDATE ON "public"."despesas_parcelas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_updated_at_orcamentos" BEFORE UPDATE ON "public"."orcamentos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_updated_at_receitas" BEFORE UPDATE ON "public"."receitas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cartoes"
    ADD CONSTRAINT "cartoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."contas_bancarias"
    ADD CONSTRAINT "contas_bancarias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_cartao_id_fkey" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_categoria_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."despesas_parcelas"
    ADD CONSTRAINT "despesas_parcelas_despesa_id_fkey" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "fk_receitas_recurrence_id" FOREIGN KEY ("recurrence_id") REFERENCES "public"."receitas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."investimentos"
    ADD CONSTRAINT "investimentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfce_cnpj_categoria"
    ADD CONSTRAINT "nfce_cnpj_categoria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfce_compras"
    ADD CONSTRAINT "nfce_compras_despesa_id_fkey" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfce_compras"
    ADD CONSTRAINT "nfce_compras_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfce_itens"
    ADD CONSTRAINT "nfce_itens_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."nfce_compras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receitas_ocorrencias"
    ADD CONSTRAINT "receitas_ocorrencias_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "public"."receitas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_tipo_receita_id_fkey" FOREIGN KEY ("tipo_receita_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."receitas"
    ADD CONSTRAINT "receitas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_items"
    ADD CONSTRAINT "shopping_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete subscription plans" ON "public"."subscription_plans" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert subscription plans" ON "public"."subscription_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update subscription plans" ON "public"."subscription_plans" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Authenticated users can read subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable delete for users based on receita_id" ON "public"."receitas_ocorrencias" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."receitas"
  WHERE (("receitas"."id" = "receitas_ocorrencias"."receita_id") AND ("receitas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."categorias" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."receitas_ocorrencias" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Enable read access for all users" ON "public"."categorias" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."receitas_ocorrencias" FOR SELECT USING (true);



CREATE POLICY "Enable update for users based on receita_id" ON "public"."receitas_ocorrencias" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."receitas"
  WHERE (("receitas"."id" = "receitas_ocorrencias"."receita_id") AND ("receitas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Leitura de indexadores para usuários autenticados" ON "public"."indexadores" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Only admins can delete subscriptions" ON "public"."subscriptions" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Only admins can insert subscriptions" ON "public"."subscriptions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Only admins can update subscriptions" ON "public"."subscriptions" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Users can delete their own cartoes" ON "public"."cartoes" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own categories" ON "public"."categorias" FOR DELETE USING ((("user_id" IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can delete their own contas_bancarias" ON "public"."contas_bancarias" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own despesas" ON "public"."despesas" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own despesas_parcelas" ON "public"."despesas_parcelas" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."despesas"
  WHERE (("despesas"."id" = "despesas_parcelas"."despesa_id") AND ("despesas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete their own investments" ON "public"."investimentos" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own metas" ON "public"."metas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own receitas" ON "public"."receitas" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own shopping items" ON "public"."shopping_items" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert roles" ON "public"."user_roles" FOR INSERT WITH CHECK ((("role" <> 'admin'::"public"."app_role") OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'admin'::"public"."app_role")));



CREATE POLICY "Users can insert their own audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own cartoes" ON "public"."cartoes" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own contas_bancarias" ON "public"."contas_bancarias" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own despesas" ON "public"."despesas" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own despesas_parcelas" ON "public"."despesas_parcelas" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."despesas"
  WHERE (("despesas"."id" = "despesas_parcelas"."despesa_id") AND ("despesas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert their own investments" ON "public"."investimentos" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own metas" ON "public"."metas" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own receitas" ON "public"."receitas" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own shopping items" ON "public"."shopping_items" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own orcamentos" ON "public"."orcamentos" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own cartoes" ON "public"."cartoes" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own categories" ON "public"."categorias" FOR UPDATE USING ((("user_id" IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can update their own contas_bancarias" ON "public"."contas_bancarias" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own despesas" ON "public"."despesas" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own despesas_parcelas" ON "public"."despesas_parcelas" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."despesas"
  WHERE (("despesas"."id" = "despesas_parcelas"."despesa_id") AND ("despesas"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."despesas"
  WHERE (("despesas"."id" = "despesas_parcelas"."despesa_id") AND ("despesas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update their own investments" ON "public"."investimentos" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own metas" ON "public"."metas" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own receitas" ON "public"."receitas" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own shopping items" ON "public"."shopping_items" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view roles" ON "public"."user_roles" FOR SELECT USING (("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'admin'::"public"."app_role") OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their own audit logs" ON "public"."audit_logs" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own cartoes" ON "public"."cartoes" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own contas_bancarias" ON "public"."contas_bancarias" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own despesas" ON "public"."despesas" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own despesas_parcelas" ON "public"."despesas_parcelas" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."despesas"
  WHERE (("despesas"."id" = "despesas_parcelas"."despesa_id") AND ("despesas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their own investments" ON "public"."investimentos" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own metas" ON "public"."metas" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own receitas" ON "public"."receitas" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own shopping items" ON "public"."shopping_items" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Usuários podem atualizar itens das suas compras NFC-e" ON "public"."nfce_itens" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."nfce_compras"
  WHERE (("nfce_compras"."id" = "nfce_itens"."compra_id") AND ("nfce_compras"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem atualizar suas próprias compras NFC-e" ON "public"."nfce_compras" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem deletar itens das suas compras NFC-e" ON "public"."nfce_itens" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."nfce_compras"
  WHERE (("nfce_compras"."id" = "nfce_itens"."compra_id") AND ("nfce_compras"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem deletar suas próprias compras NFC-e" ON "public"."nfce_compras" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem inserir itens nas suas compras NFC-e" ON "public"."nfce_itens" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."nfce_compras"
  WHERE (("nfce_compras"."id" = "nfce_itens"."compra_id") AND ("nfce_compras"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem inserir suas próprias compras NFC-e" ON "public"."nfce_compras" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem ver apenas os itens das suas compras NFC-e" ON "public"."nfce_itens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."nfce_compras"
  WHERE (("nfce_compras"."id" = "nfce_itens"."compra_id") AND ("nfce_compras"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários podem ver apenas suas próprias compras NFC-e" ON "public"."nfce_compras" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cartoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contas_bancarias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."despesas_parcelas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."indexadores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."investimentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfce_cnpj_categoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfce_compras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfce_itens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orcamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receitas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receitas_ocorrencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios atualizam seus mapeamentos" ON "public"."nfce_cnpj_categoria" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "usuarios inserem seus mapeamentos" ON "public"."nfce_cnpj_categoria" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "usuarios removem seus mapeamentos" ON "public"."nfce_cnpj_categoria" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "usuarios veem seus mapeamentos" ON "public"."nfce_cnpj_categoria" FOR SELECT USING (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cartoes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categorias";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."despesas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."despesas_parcelas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."receitas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."receitas_ocorrencias";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."shopping_items";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."generate_recurring_entries"("p_user_id" "uuid", "p_transaction_type" "text", "p_master_id" "uuid", "p_first_occurrence_date" "date", "p_monthly_amount" numeric, "p_category_id" "text", "p_description" "text", "p_status" "public"."receita_status", "p_recurrence_day" integer, "p_total_installments" integer, "p_forma_pagamento" "text", "p_cartao_id" "uuid", "p_tipo_pagamento" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_recurring_entries"("p_user_id" "uuid", "p_transaction_type" "text", "p_master_id" "uuid", "p_first_occurrence_date" "date", "p_monthly_amount" numeric, "p_category_id" "text", "p_description" "text", "p_status" "public"."receita_status", "p_recurrence_day" integer, "p_total_installments" integer, "p_forma_pagamento" "text", "p_cartao_id" "uuid", "p_tipo_pagamento" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_recurring_entries"("p_user_id" "uuid", "p_transaction_type" "text", "p_master_id" "uuid", "p_first_occurrence_date" "date", "p_monthly_amount" numeric, "p_category_id" "text", "p_description" "text", "p_status" "public"."receita_status", "p_recurrence_day" integer, "p_total_installments" integer, "p_forma_pagamento" "text", "p_cartao_id" "uuid", "p_tipo_pagamento" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_audit"("p_user_id" "uuid", "p_action_type" "text", "p_table_name" "text", "p_record_id" "text", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_audit"("p_user_id" "uuid", "p_action_type" "text", "p_table_name" "text", "p_record_id" "text", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_audit"("p_user_id" "uuid", "p_action_type" "text", "p_table_name" "text", "p_record_id" "text", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shopping_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shopping_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shopping_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."cartoes" TO "anon";
GRANT ALL ON TABLE "public"."cartoes" TO "authenticated";
GRANT ALL ON TABLE "public"."cartoes" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."contas_bancarias" TO "anon";
GRANT ALL ON TABLE "public"."contas_bancarias" TO "authenticated";
GRANT ALL ON TABLE "public"."contas_bancarias" TO "service_role";



GRANT ALL ON TABLE "public"."despesas" TO "anon";
GRANT ALL ON TABLE "public"."despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas" TO "service_role";



GRANT ALL ON TABLE "public"."despesas_parcelas" TO "anon";
GRANT ALL ON TABLE "public"."despesas_parcelas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas_parcelas" TO "service_role";



GRANT ALL ON TABLE "public"."indexadores" TO "anon";
GRANT ALL ON TABLE "public"."indexadores" TO "authenticated";
GRANT ALL ON TABLE "public"."indexadores" TO "service_role";



GRANT ALL ON TABLE "public"."investimentos" TO "anon";
GRANT ALL ON TABLE "public"."investimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."investimentos" TO "service_role";



GRANT ALL ON TABLE "public"."metas" TO "anon";
GRANT ALL ON TABLE "public"."metas" TO "authenticated";
GRANT ALL ON TABLE "public"."metas" TO "service_role";



GRANT ALL ON TABLE "public"."nfce_cnpj_categoria" TO "anon";
GRANT ALL ON TABLE "public"."nfce_cnpj_categoria" TO "authenticated";
GRANT ALL ON TABLE "public"."nfce_cnpj_categoria" TO "service_role";



GRANT ALL ON TABLE "public"."nfce_compras" TO "anon";
GRANT ALL ON TABLE "public"."nfce_compras" TO "authenticated";
GRANT ALL ON TABLE "public"."nfce_compras" TO "service_role";



GRANT ALL ON TABLE "public"."nfce_itens" TO "anon";
GRANT ALL ON TABLE "public"."nfce_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."nfce_itens" TO "service_role";



GRANT ALL ON TABLE "public"."orcamentos" TO "anon";
GRANT ALL ON TABLE "public"."orcamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."orcamentos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."receitas" TO "anon";
GRANT ALL ON TABLE "public"."receitas" TO "authenticated";
GRANT ALL ON TABLE "public"."receitas" TO "service_role";



GRANT ALL ON TABLE "public"."receitas_ocorrencias" TO "anon";
GRANT ALL ON TABLE "public"."receitas_ocorrencias" TO "authenticated";
GRANT ALL ON TABLE "public"."receitas_ocorrencias" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_items" TO "anon";
GRANT ALL ON TABLE "public"."shopping_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shopping_items" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vw_gastos_por_categoria" TO "anon";
GRANT ALL ON TABLE "public"."vw_gastos_por_categoria" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_gastos_por_categoria" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

alter table "public"."orcamentos" drop constraint "check_tipo_planejamento";

alter table "public"."orcamentos" add constraint "check_tipo_planejamento" CHECK (((tipo_planejamento)::text = ANY ((ARRAY['valor'::character varying, 'percentual'::character varying])::text[]))) not valid;

alter table "public"."orcamentos" validate constraint "check_tipo_planejamento";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

drop trigger if exists "objects_delete_delete_prefix" on "storage"."objects";

drop trigger if exists "objects_insert_create_prefix" on "storage"."objects";

drop trigger if exists "objects_update_create_prefix" on "storage"."objects";

drop trigger if exists "prefixes_create_hierarchy" on "storage"."prefixes";

drop trigger if exists "prefixes_delete_hierarchy" on "storage"."prefixes";

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


