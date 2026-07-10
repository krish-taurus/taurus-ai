-- Taurus AI — authoritative database schema baseline (generated, reference).
--
-- A pg_dump --schema-only snapshot of a database built by applying every
-- migration in db/migrations in order (0001 → 0020) to a fresh PostgreSQL 16 +
-- pgvector instance. It is the single, reviewable picture of the full schema for
-- audits and onboarding, and can stand up a fresh database in one pass.
--
-- The migration files remain the source of truth for changes; regenerate this
-- file after adding a migration. Do not hand-edit.
-- ---------------------------------------------------------------------------

--
-- PostgreSQL database dump
--

\restrict MrnQhPwFkffbRLQ21grLZ8VSsrGMZeAdLbWTdJw39fii6zajts2ry2TdM7L927P

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    role_title text NOT NULL,
    department text,
    status text DEFAULT 'draft'::text NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    description text,
    avatar_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsibilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    working_style jsonb
);


--
-- Name: ai_model_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    provider_type text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    default_base_url text,
    supports_platform_key boolean DEFAULT true NOT NULL,
    supports_byok boolean DEFAULT true NOT NULL,
    documentation_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_slug text NOT NULL,
    model_id text NOT NULL,
    display_name text NOT NULL,
    model_family text,
    status text DEFAULT 'available'::text NOT NULL,
    model_tier text NOT NULL,
    recommended_for text,
    context_window_tokens integer,
    max_output_tokens integer,
    supports_text boolean DEFAULT true NOT NULL,
    supports_vision boolean DEFAULT false NOT NULL,
    supports_audio boolean DEFAULT false NOT NULL,
    supports_tools boolean DEFAULT false NOT NULL,
    supports_json boolean DEFAULT false NOT NULL,
    supports_streaming boolean DEFAULT false NOT NULL,
    supports_reasoning boolean DEFAULT false NOT NULL,
    supports_caching boolean DEFAULT false NOT NULL,
    input_usd_per_million_tokens numeric,
    cached_input_usd_per_million_tokens numeric,
    output_usd_per_million_tokens numeric,
    pricing_notes text,
    pricing_source_url text,
    price_checked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    actor_type text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text,
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    external_customer_id text NOT NULL,
    provider text DEFAULT 'stripe'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    plan_id text,
    status text,
    provider text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_overage_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_overage_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    period_start timestamp with time zone NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_usd numeric NOT NULL,
    amount_usd numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider text NOT NULL,
    external_usage_record_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_start timestamp with time zone DEFAULT now() NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    external_subscription_id text,
    external_customer_id text,
    provider text DEFAULT 'simulated'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    overage_policy text DEFAULT 'hard_cap'::text NOT NULL,
    overage_spend_cap_usd numeric
);


--
-- Name: channel_provider_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_type text NOT NULL,
    credential_mode text DEFAULT 'disabled'::text NOT NULL,
    encrypted_credentials text,
    credential_label text,
    key_last_four text,
    status text DEFAULT 'disabled'::text NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    channel_id uuid,
    provider_type text NOT NULL,
    event_type text NOT NULL,
    external_event_id text,
    status text DEFAULT 'received'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collaboration_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboration_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    requesting_employee_id uuid NOT NULL,
    responding_employee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    request_text text NOT NULL,
    response_text text,
    permission_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    confidence numeric,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    user_id uuid,
    channel text DEFAULT 'chat'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    channel_type text NOT NULL,
    channel_provider text DEFAULT 'taurus_web'::text NOT NULL,
    public_key text NOT NULL,
    secret_hash text,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    allowed_domains jsonb DEFAULT '[]'::jsonb NOT NULL,
    appearance jsonb DEFAULT '{}'::jsonb NOT NULL,
    provider_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    welcome_message text,
    rate_limit_per_minute integer DEFAULT 20 NOT NULL,
    rate_limit_per_day integer DEFAULT 500 NOT NULL,
    created_by_user_id uuid,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    source_references jsonb,
    model_provider_slug text,
    model_id text,
    model_tier text,
    routing_mode text,
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric,
    latency_ms integer,
    error_code text,
    brain_mode text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_chat_retrieval_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_chat_retrieval_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    thread_id uuid,
    message_id uuid,
    query_text_hash text,
    retrieved_source_count integer DEFAULT 0 NOT NULL,
    top_source_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    title text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_user_id uuid,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_dna_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_dna_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    version_number integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    schema_version text DEFAULT '1.0'::text NOT NULL,
    dna jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id uuid,
    published_by_user_id uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_knowledge_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    knowledge_source_id uuid NOT NULL,
    assigned_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_model_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_model_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    model_id text,
    routing_mode text,
    max_monthly_budget_usd numeric,
    fallback_model_id text,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    knowledge_source_id uuid NOT NULL,
    title text NOT NULL,
    original_filename text,
    content_type text,
    byte_size integer,
    checksum_sha256 text,
    storage_key text,
    text_content text,
    text_preview text,
    extraction_status text DEFAULT 'not_required'::text NOT NULL,
    extraction_error text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_retrieval_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_retrieval_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    knowledge_source_id uuid NOT NULL,
    knowledge_document_id uuid,
    title text NOT NULL,
    content text NOT NULL,
    content_preview text NOT NULL,
    segment_index integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ready'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector,
    embedding_model_id text,
    embedding_dim integer
);


--
-- Name: knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    source_type text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    visibility text DEFAULT 'organization'::text NOT NULL,
    created_by_user_id uuid,
    archived_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    indexing_state text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: llm_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid,
    provider_slug text NOT NULL,
    model_id text NOT NULL,
    task_type text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    estimated_cost_usd numeric,
    latency_ms integer,
    status text DEFAULT 'success'::text NOT NULL,
    error_code text,
    request_id_hash text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_usd numeric,
    unit_input_price numeric,
    unit_output_price numeric,
    byok boolean DEFAULT false NOT NULL,
    channel_type text
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid,
    sender_type text NOT NULL,
    sender_id uuid,
    content text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence numeric,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messaging_contact_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_contact_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    external_contact_id text,
    normalized_contact_hash text NOT NULL,
    channel_type text NOT NULL,
    opt_in_status text DEFAULT 'unknown'::text NOT NULL,
    blocked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messaging_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_id uuid,
    provider_type text NOT NULL,
    template_name text NOT NULL,
    template_category text DEFAULT 'utility'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    external_template_id text,
    body_preview text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_model_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_model_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    default_model_id text,
    routing_mode text DEFAULT 'auto_balanced'::text NOT NULL,
    allowed_provider_slugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    blocked_provider_slugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    monthly_budget_usd numeric,
    budget_alert_threshold_percent integer,
    fallback_model_id text,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_onboarding (
    organization_id uuid NOT NULL,
    dismissed_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_provider_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_slug text NOT NULL,
    credential_mode text DEFAULT 'taurus_managed'::text NOT NULL,
    encrypted_api_key text,
    key_last_four text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    base_url text,
    label text
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    industry text,
    website_url text,
    size_range text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_access_mode text DEFAULT 'managed'::text NOT NULL
);


--
-- Name: performance_criterion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_criterion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    scorecard_id uuid NOT NULL,
    label text NOT NULL,
    guidance text DEFAULT ''::text NOT NULL,
    method text NOT NULL,
    expected text,
    weight numeric DEFAULT 1 NOT NULL,
    pass_threshold numeric DEFAULT 0.7 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_review_case; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_review_case (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    scorecard_id uuid NOT NULL,
    name text NOT NULL,
    situation text NOT NULL,
    expected text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_review_result; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_review_result (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    run_id uuid NOT NULL,
    case_id uuid NOT NULL,
    employee_output text DEFAULT ''::text NOT NULL,
    passed boolean DEFAULT false NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    criterion_scores jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_review_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_review_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    scorecard_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    dna_version_id uuid NOT NULL,
    dna_version_number integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    overall_score numeric,
    passed_cases integer DEFAULT 0 NOT NULL,
    total_cases integer DEFAULT 0 NOT NULL,
    error text,
    started_by_user_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: performance_scorecard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_scorecard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_channel_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_channel_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid,
    channel_id uuid,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    thread_id uuid,
    visitor_id text NOT NULL,
    visitor_label text,
    origin_domain text,
    user_agent_hash text,
    ip_hash text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid,
    event_type text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    supabase_auth_user_id text
);


--
-- Name: voice_call_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_call_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    phone_number_id uuid,
    provider_type text NOT NULL,
    external_call_id text,
    direction text DEFAULT 'inbound'::text NOT NULL,
    caller_hash text,
    caller_label text,
    status text DEFAULT 'ringing'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_seconds integer,
    end_reason text,
    recording_status text DEFAULT 'disabled'::text NOT NULL,
    transcript_status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_call_transcript_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_call_transcript_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    call_session_id uuid NOT NULL,
    speaker_type text NOT NULL,
    content text NOT NULL,
    confidence numeric,
    started_at_ms integer,
    ended_at_ms integer,
    source_references jsonb,
    model_provider_slug text,
    model_id text,
    estimated_cost_usd numeric,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_phone_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_phone_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    provider_type text NOT NULL,
    phone_number text NOT NULL,
    display_label text,
    external_phone_number_id text,
    country_code text,
    capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: voice_stream_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_stream_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    channel_id uuid,
    call_session_id uuid,
    provider_type text NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'ok'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_employees ai_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_employees
    ADD CONSTRAINT ai_employees_pkey PRIMARY KEY (id);


--
-- Name: ai_model_providers ai_model_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_providers
    ADD CONSTRAINT ai_model_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_model_providers ai_model_providers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_providers
    ADD CONSTRAINT ai_model_providers_slug_key UNIQUE (slug);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_provider_slug_model_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_provider_slug_model_id_key UNIQUE (provider_slug, model_id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: billing_customers billing_customers_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_organization_id_key UNIQUE (organization_id);


--
-- Name: billing_customers billing_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);


--
-- Name: billing_overage_items billing_overage_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_overage_items
    ADD CONSTRAINT billing_overage_items_pkey PRIMARY KEY (id);


--
-- Name: billing_subscriptions billing_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: channel_provider_credentials channel_provider_credentials_organization_id_provider_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_provider_credentials
    ADD CONSTRAINT channel_provider_credentials_organization_id_provider_type_key UNIQUE (organization_id, provider_type);


--
-- Name: channel_provider_credentials channel_provider_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_provider_credentials
    ADD CONSTRAINT channel_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: channel_webhook_events channel_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_webhook_events
    ADD CONSTRAINT channel_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: collaboration_requests collaboration_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_requests
    ADD CONSTRAINT collaboration_requests_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: employee_channels employee_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_channels
    ADD CONSTRAINT employee_channels_pkey PRIMARY KEY (id);


--
-- Name: employee_channels employee_channels_public_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_channels
    ADD CONSTRAINT employee_channels_public_key_key UNIQUE (public_key);


--
-- Name: employee_chat_messages employee_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_messages
    ADD CONSTRAINT employee_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: employee_chat_retrieval_events employee_chat_retrieval_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_retrieval_events
    ADD CONSTRAINT employee_chat_retrieval_events_pkey PRIMARY KEY (id);


--
-- Name: employee_chat_threads employee_chat_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_threads
    ADD CONSTRAINT employee_chat_threads_pkey PRIMARY KEY (id);


--
-- Name: employee_dna_versions employee_dna_versions_employee_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_employee_id_version_number_key UNIQUE (employee_id, version_number);


--
-- Name: employee_dna_versions employee_dna_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_pkey PRIMARY KEY (id);


--
-- Name: employee_knowledge_sources employee_knowledge_sources_employee_id_knowledge_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_employee_id_knowledge_source_id_key UNIQUE (employee_id, knowledge_source_id);


--
-- Name: employee_knowledge_sources employee_knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: employee_model_settings employee_model_settings_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_model_settings
    ADD CONSTRAINT employee_model_settings_employee_id_key UNIQUE (employee_id);


--
-- Name: employee_model_settings employee_model_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_model_settings
    ADD CONSTRAINT employee_model_settings_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_retrieval_segments knowledge_retrieval_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_retrieval_segments
    ADD CONSTRAINT knowledge_retrieval_segments_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: llm_usage_events llm_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage_events
    ADD CONSTRAINT llm_usage_events_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: messaging_contact_preferences messaging_contact_preferences_channel_id_normalized_contact_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_contact_preferences
    ADD CONSTRAINT messaging_contact_preferences_channel_id_normalized_contact_key UNIQUE (channel_id, normalized_contact_hash);


--
-- Name: messaging_contact_preferences messaging_contact_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_contact_preferences
    ADD CONSTRAINT messaging_contact_preferences_pkey PRIMARY KEY (id);


--
-- Name: messaging_templates messaging_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organization_model_settings organization_model_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_model_settings
    ADD CONSTRAINT organization_model_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_model_settings organization_model_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_model_settings
    ADD CONSTRAINT organization_model_settings_pkey PRIMARY KEY (id);


--
-- Name: organization_onboarding organization_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_onboarding
    ADD CONSTRAINT organization_onboarding_pkey PRIMARY KEY (organization_id);


--
-- Name: organization_provider_credentials organization_provider_credent_organization_id_provider_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_provider_credentials
    ADD CONSTRAINT organization_provider_credent_organization_id_provider_slug_key UNIQUE (organization_id, provider_slug);


--
-- Name: organization_provider_credentials organization_provider_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_provider_credentials
    ADD CONSTRAINT organization_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: performance_criterion performance_criterion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_criterion
    ADD CONSTRAINT performance_criterion_pkey PRIMARY KEY (id);


--
-- Name: performance_review_case performance_review_case_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_case
    ADD CONSTRAINT performance_review_case_pkey PRIMARY KEY (id);


--
-- Name: performance_review_result performance_review_result_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_result
    ADD CONSTRAINT performance_review_result_pkey PRIMARY KEY (id);


--
-- Name: performance_review_run performance_review_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_run
    ADD CONSTRAINT performance_review_run_pkey PRIMARY KEY (id);


--
-- Name: performance_scorecard performance_scorecard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_scorecard
    ADD CONSTRAINT performance_scorecard_pkey PRIMARY KEY (id);


--
-- Name: public_channel_events public_channel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_channel_events
    ADD CONSTRAINT public_channel_events_pkey PRIMARY KEY (id);


--
-- Name: public_chat_sessions public_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_chat_sessions
    ADD CONSTRAINT public_chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: voice_call_sessions voice_call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_sessions
    ADD CONSTRAINT voice_call_sessions_pkey PRIMARY KEY (id);


--
-- Name: voice_call_transcript_messages voice_call_transcript_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_transcript_messages
    ADD CONSTRAINT voice_call_transcript_messages_pkey PRIMARY KEY (id);


--
-- Name: voice_phone_numbers voice_phone_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_phone_numbers
    ADD CONSTRAINT voice_phone_numbers_pkey PRIMARY KEY (id);


--
-- Name: voice_stream_events voice_stream_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_stream_events
    ADD CONSTRAINT voice_stream_events_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_employees_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_employees_created_by ON public.ai_employees USING btree (created_by);


--
-- Name: idx_ai_models_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_provider ON public.ai_models USING btree (provider_slug);


--
-- Name: idx_audit_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_org_created ON public.audit_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_billing_customers_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_customers_external ON public.billing_customers USING btree (external_customer_id);


--
-- Name: idx_billing_customers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_customers_org ON public.billing_customers USING btree (organization_id);


--
-- Name: idx_billing_events_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_events_org_created ON public.billing_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_billing_overage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_overage_created ON public.billing_overage_items USING btree (created_at DESC);


--
-- Name: idx_billing_overage_org_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_overage_org_period ON public.billing_overage_items USING btree (organization_id, period_start);


--
-- Name: idx_billing_subscriptions_external_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_subscriptions_external_sub ON public.billing_subscriptions USING btree (external_subscription_id);


--
-- Name: idx_billing_subscriptions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_subscriptions_org ON public.billing_subscriptions USING btree (organization_id);


--
-- Name: idx_channel_events_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_events_channel ON public.public_channel_events USING btree (channel_id);


--
-- Name: idx_channel_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_events_created ON public.public_channel_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_channel_events_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_events_employee ON public.public_channel_events USING btree (employee_id);


--
-- Name: idx_channel_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_events_org ON public.public_channel_events USING btree (organization_id);


--
-- Name: idx_channel_provider_credentials_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_provider_credentials_created_by_user_id ON public.channel_provider_credentials USING btree (created_by_user_id);


--
-- Name: idx_channel_provider_credentials_updated_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_provider_credentials_updated_by_user_id ON public.channel_provider_credentials USING btree (updated_by_user_id);


--
-- Name: idx_channels_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_employee ON public.employee_channels USING btree (employee_id);


--
-- Name: idx_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org ON public.employee_channels USING btree (organization_id);


--
-- Name: idx_channels_org_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org_employee ON public.employee_channels USING btree (organization_id, employee_id, status);


--
-- Name: idx_channels_public_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_channels_public_key ON public.employee_channels USING btree (public_key);


--
-- Name: idx_chat_messages_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_employee ON public.employee_chat_messages USING btree (employee_id);


--
-- Name: idx_chat_messages_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_org ON public.employee_chat_messages USING btree (organization_id);


--
-- Name: idx_chat_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_thread ON public.employee_chat_messages USING btree (thread_id, created_at);


--
-- Name: idx_chat_threads_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_employee ON public.employee_chat_threads USING btree (employee_id);


--
-- Name: idx_chat_threads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_org ON public.employee_chat_threads USING btree (organization_id);


--
-- Name: idx_chat_threads_org_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_org_employee ON public.employee_chat_threads USING btree (organization_id, employee_id, status);


--
-- Name: idx_collab_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_org ON public.collaboration_requests USING btree (organization_id);


--
-- Name: idx_collaboration_requests_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_requests_created_by ON public.collaboration_requests USING btree (created_by);


--
-- Name: idx_collaboration_requests_requesting_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_requests_requesting_employee_id ON public.collaboration_requests USING btree (requesting_employee_id);


--
-- Name: idx_collaboration_requests_responding_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaboration_requests_responding_employee_id ON public.collaboration_requests USING btree (responding_employee_id);


--
-- Name: idx_contact_prefs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_prefs_channel ON public.messaging_contact_preferences USING btree (channel_id);


--
-- Name: idx_contact_prefs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_prefs_org ON public.messaging_contact_preferences USING btree (organization_id);


--
-- Name: idx_conversations_org_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_employee ON public.conversations USING btree (organization_id, employee_id);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_dna_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dna_employee ON public.employee_dna_versions USING btree (employee_id);


--
-- Name: idx_dna_employee_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dna_employee_version ON public.employee_dna_versions USING btree (employee_id, version_number);


--
-- Name: idx_dna_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dna_org ON public.employee_dna_versions USING btree (organization_id);


--
-- Name: idx_dna_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dna_status ON public.employee_dna_versions USING btree (status);


--
-- Name: idx_employee_channels_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_channels_created_by_user_id ON public.employee_channels USING btree (created_by_user_id);


--
-- Name: idx_employee_chat_messages_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_chat_messages_created_by_user_id ON public.employee_chat_messages USING btree (created_by_user_id);


--
-- Name: idx_employee_chat_retrieval_events_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_chat_retrieval_events_message_id ON public.employee_chat_retrieval_events USING btree (message_id);


--
-- Name: idx_employee_chat_threads_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_chat_threads_created_by_user_id ON public.employee_chat_threads USING btree (created_by_user_id);


--
-- Name: idx_employee_dna_versions_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_dna_versions_created_by_user_id ON public.employee_dna_versions USING btree (created_by_user_id);


--
-- Name: idx_employee_dna_versions_published_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_dna_versions_published_by_user_id ON public.employee_dna_versions USING btree (published_by_user_id);


--
-- Name: idx_employee_knowledge_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_knowledge_employee ON public.employee_knowledge_sources USING btree (employee_id);


--
-- Name: idx_employee_knowledge_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_knowledge_org ON public.employee_knowledge_sources USING btree (organization_id);


--
-- Name: idx_employee_knowledge_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_knowledge_source ON public.employee_knowledge_sources USING btree (knowledge_source_id);


--
-- Name: idx_employee_knowledge_sources_assigned_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_knowledge_sources_assigned_by_user_id ON public.employee_knowledge_sources USING btree (assigned_by_user_id);


--
-- Name: idx_employee_model_settings_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_model_settings_employee ON public.employee_model_settings USING btree (employee_id);


--
-- Name: idx_employee_model_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_model_settings_org ON public.employee_model_settings USING btree (organization_id);


--
-- Name: idx_employee_model_settings_updated_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_model_settings_updated_by_user_id ON public.employee_model_settings USING btree (updated_by_user_id);


--
-- Name: idx_employees_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_org ON public.ai_employees USING btree (organization_id);


--
-- Name: idx_employees_org_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_org_updated ON public.ai_employees USING btree (organization_id, updated_at DESC);


--
-- Name: idx_knowledge_documents_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_documents_created_by_user_id ON public.knowledge_documents USING btree (created_by_user_id);


--
-- Name: idx_knowledge_documents_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_documents_org ON public.knowledge_documents USING btree (organization_id);


--
-- Name: idx_knowledge_documents_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_documents_source ON public.knowledge_documents USING btree (knowledge_source_id);


--
-- Name: idx_knowledge_sources_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_sources_created_by_user_id ON public.knowledge_sources USING btree (created_by_user_id);


--
-- Name: idx_knowledge_sources_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_sources_org ON public.knowledge_sources USING btree (organization_id);


--
-- Name: idx_knowledge_sources_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_sources_org_status ON public.knowledge_sources USING btree (organization_id, status);


--
-- Name: idx_krs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_krs_org ON public.knowledge_retrieval_segments USING btree (organization_id);


--
-- Name: idx_llm_usage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_created ON public.llm_usage_events USING btree (created_at DESC);


--
-- Name: idx_llm_usage_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_employee ON public.llm_usage_events USING btree (employee_id);


--
-- Name: idx_llm_usage_events_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_events_created_by_user_id ON public.llm_usage_events USING btree (created_by_user_id);


--
-- Name: idx_llm_usage_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_org_created ON public.llm_usage_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_employee_id ON public.messages USING btree (employee_id);


--
-- Name: idx_messages_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_organization_id ON public.messages USING btree (organization_id);


--
-- Name: idx_messaging_templates_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_channel ON public.messaging_templates USING btree (channel_id);


--
-- Name: idx_messaging_templates_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_created_by_user_id ON public.messaging_templates USING btree (created_by_user_id);


--
-- Name: idx_messaging_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_org ON public.messaging_templates USING btree (organization_id);


--
-- Name: idx_org_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org ON public.organization_members USING btree (organization_id);


--
-- Name: idx_org_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);


--
-- Name: idx_org_model_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_model_settings_org ON public.organization_model_settings USING btree (organization_id);


--
-- Name: idx_organization_model_settings_updated_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_model_settings_updated_by_user_id ON public.organization_model_settings USING btree (updated_by_user_id);


--
-- Name: idx_organization_onboarding_updated_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_onboarding_updated_by_user_id ON public.organization_onboarding USING btree (updated_by_user_id);


--
-- Name: idx_organization_provider_credentials_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_provider_credentials_created_by_user_id ON public.organization_provider_credentials USING btree (created_by_user_id);


--
-- Name: idx_organization_provider_credentials_updated_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_provider_credentials_updated_by_user_id ON public.organization_provider_credentials USING btree (updated_by_user_id);


--
-- Name: idx_performance_case_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_case_org ON public.performance_review_case USING btree (organization_id);


--
-- Name: idx_performance_case_scorecard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_case_scorecard ON public.performance_review_case USING btree (organization_id, scorecard_id);


--
-- Name: idx_performance_criterion_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_criterion_org ON public.performance_criterion USING btree (organization_id);


--
-- Name: idx_performance_criterion_scorecard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_criterion_scorecard ON public.performance_criterion USING btree (organization_id, scorecard_id);


--
-- Name: idx_performance_result_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_result_org ON public.performance_review_result USING btree (organization_id);


--
-- Name: idx_performance_result_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_result_run ON public.performance_review_result USING btree (organization_id, run_id);


--
-- Name: idx_performance_review_result_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_review_result_case_id ON public.performance_review_result USING btree (case_id);


--
-- Name: idx_performance_review_run_scorecard_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_review_run_scorecard_id ON public.performance_review_run USING btree (scorecard_id);


--
-- Name: idx_performance_review_run_started_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_review_run_started_by_user_id ON public.performance_review_run USING btree (started_by_user_id);


--
-- Name: idx_performance_run_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_run_employee ON public.performance_review_run USING btree (organization_id, employee_id, started_at);


--
-- Name: idx_performance_run_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_run_org ON public.performance_review_run USING btree (organization_id);


--
-- Name: idx_performance_scorecard_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_scorecard_created_by_user_id ON public.performance_scorecard USING btree (created_by_user_id);


--
-- Name: idx_performance_scorecard_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_scorecard_org ON public.performance_scorecard USING btree (organization_id);


--
-- Name: idx_provider_credentials_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_credentials_org ON public.organization_provider_credentials USING btree (organization_id);


--
-- Name: idx_provider_creds_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_creds_org ON public.channel_provider_credentials USING btree (organization_id);


--
-- Name: idx_public_chat_sessions_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_chat_sessions_thread_id ON public.public_chat_sessions USING btree (thread_id);


--
-- Name: idx_public_sessions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_sessions_channel ON public.public_chat_sessions USING btree (channel_id);


--
-- Name: idx_public_sessions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_sessions_employee ON public.public_chat_sessions USING btree (employee_id);


--
-- Name: idx_public_sessions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_sessions_org ON public.public_chat_sessions USING btree (organization_id);


--
-- Name: idx_public_sessions_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_sessions_visitor ON public.public_chat_sessions USING btree (channel_id, visitor_id);


--
-- Name: idx_retrieval_events_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_events_employee ON public.employee_chat_retrieval_events USING btree (employee_id);


--
-- Name: idx_retrieval_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_events_org ON public.employee_chat_retrieval_events USING btree (organization_id);


--
-- Name: idx_retrieval_events_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_events_thread ON public.employee_chat_retrieval_events USING btree (thread_id);


--
-- Name: idx_retrieval_segments_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_segments_document ON public.knowledge_retrieval_segments USING btree (knowledge_document_id);


--
-- Name: idx_retrieval_segments_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_segments_org ON public.knowledge_retrieval_segments USING btree (organization_id);


--
-- Name: idx_retrieval_segments_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retrieval_segments_source ON public.knowledge_retrieval_segments USING btree (knowledge_source_id);


--
-- Name: idx_usage_events_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_employee_id ON public.usage_events USING btree (employee_id);


--
-- Name: idx_usage_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_org_created ON public.usage_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_voice_call_sessions_phone_number_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_call_sessions_phone_number_id ON public.voice_call_sessions USING btree (phone_number_id);


--
-- Name: idx_voice_call_transcript_messages_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_call_transcript_messages_channel_id ON public.voice_call_transcript_messages USING btree (channel_id);


--
-- Name: idx_voice_call_transcript_messages_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_call_transcript_messages_employee_id ON public.voice_call_transcript_messages USING btree (employee_id);


--
-- Name: idx_voice_calls_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_calls_channel ON public.voice_call_sessions USING btree (channel_id, started_at DESC);


--
-- Name: idx_voice_calls_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_calls_employee ON public.voice_call_sessions USING btree (employee_id);


--
-- Name: idx_voice_calls_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_calls_external ON public.voice_call_sessions USING btree (provider_type, external_call_id);


--
-- Name: idx_voice_calls_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_calls_org ON public.voice_call_sessions USING btree (organization_id);


--
-- Name: idx_voice_events_call; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_events_call ON public.voice_stream_events USING btree (call_session_id, created_at);


--
-- Name: idx_voice_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_events_org ON public.voice_stream_events USING btree (organization_id);


--
-- Name: idx_voice_numbers_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_numbers_channel ON public.voice_phone_numbers USING btree (channel_id);


--
-- Name: idx_voice_numbers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_numbers_org ON public.voice_phone_numbers USING btree (organization_id);


--
-- Name: idx_voice_phone_numbers_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_phone_numbers_created_by_user_id ON public.voice_phone_numbers USING btree (created_by_user_id);


--
-- Name: idx_voice_stream_events_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_stream_events_channel_id ON public.voice_stream_events USING btree (channel_id);


--
-- Name: idx_voice_stream_events_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_stream_events_employee_id ON public.voice_stream_events USING btree (employee_id);


--
-- Name: idx_voice_transcript_call; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_transcript_call ON public.voice_call_transcript_messages USING btree (call_session_id, created_at);


--
-- Name: idx_voice_transcript_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_transcript_org ON public.voice_call_transcript_messages USING btree (organization_id);


--
-- Name: idx_webhook_events_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_channel ON public.channel_webhook_events USING btree (channel_id, received_at DESC);


--
-- Name: idx_webhook_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_org ON public.channel_webhook_events USING btree (organization_id);


--
-- Name: uniq_billing_subscription_active_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_billing_subscription_active_org ON public.billing_subscriptions USING btree (organization_id) WHERE (status <> 'canceled'::text);


--
-- Name: uniq_dna_one_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_dna_one_draft ON public.employee_dna_versions USING btree (employee_id) WHERE (status = 'draft'::text);


--
-- Name: uniq_dna_one_published; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_dna_one_published ON public.employee_dna_versions USING btree (employee_id) WHERE (status = 'published'::text);


--
-- Name: users_supabase_auth_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_supabase_auth_user_id_key ON public.users USING btree (supabase_auth_user_id) WHERE (supabase_auth_user_id IS NOT NULL);


--
-- Name: ai_employees ai_employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_employees
    ADD CONSTRAINT ai_employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ai_employees ai_employees_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_employees
    ADD CONSTRAINT ai_employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_events audit_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: billing_customers billing_customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: billing_events billing_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: billing_overage_items billing_overage_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_overage_items
    ADD CONSTRAINT billing_overage_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: billing_subscriptions billing_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channel_provider_credentials channel_provider_credentials_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_provider_credentials
    ADD CONSTRAINT channel_provider_credentials_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: channel_provider_credentials channel_provider_credentials_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_provider_credentials
    ADD CONSTRAINT channel_provider_credentials_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channel_provider_credentials channel_provider_credentials_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_provider_credentials
    ADD CONSTRAINT channel_provider_credentials_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: channel_webhook_events channel_webhook_events_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_webhook_events
    ADD CONSTRAINT channel_webhook_events_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE SET NULL;


--
-- Name: channel_webhook_events channel_webhook_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_webhook_events
    ADD CONSTRAINT channel_webhook_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: collaboration_requests collaboration_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_requests
    ADD CONSTRAINT collaboration_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: collaboration_requests collaboration_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_requests
    ADD CONSTRAINT collaboration_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: collaboration_requests collaboration_requests_requesting_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_requests
    ADD CONSTRAINT collaboration_requests_requesting_employee_id_fkey FOREIGN KEY (requesting_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: collaboration_requests collaboration_requests_responding_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_requests
    ADD CONSTRAINT collaboration_requests_responding_employee_id_fkey FOREIGN KEY (responding_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: conversations conversations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: employee_channels employee_channels_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_channels
    ADD CONSTRAINT employee_channels_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_channels employee_channels_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_channels
    ADD CONSTRAINT employee_channels_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_channels employee_channels_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_channels
    ADD CONSTRAINT employee_channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_chat_messages employee_chat_messages_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_messages
    ADD CONSTRAINT employee_chat_messages_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_chat_messages employee_chat_messages_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_messages
    ADD CONSTRAINT employee_chat_messages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_chat_messages employee_chat_messages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_messages
    ADD CONSTRAINT employee_chat_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_chat_messages employee_chat_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_messages
    ADD CONSTRAINT employee_chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.employee_chat_threads(id) ON DELETE CASCADE;


--
-- Name: employee_chat_retrieval_events employee_chat_retrieval_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_retrieval_events
    ADD CONSTRAINT employee_chat_retrieval_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_chat_retrieval_events employee_chat_retrieval_events_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_retrieval_events
    ADD CONSTRAINT employee_chat_retrieval_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.employee_chat_messages(id) ON DELETE SET NULL;


--
-- Name: employee_chat_retrieval_events employee_chat_retrieval_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_retrieval_events
    ADD CONSTRAINT employee_chat_retrieval_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_chat_retrieval_events employee_chat_retrieval_events_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_retrieval_events
    ADD CONSTRAINT employee_chat_retrieval_events_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.employee_chat_threads(id) ON DELETE CASCADE;


--
-- Name: employee_chat_threads employee_chat_threads_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_threads
    ADD CONSTRAINT employee_chat_threads_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_chat_threads employee_chat_threads_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_threads
    ADD CONSTRAINT employee_chat_threads_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_chat_threads employee_chat_threads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_chat_threads
    ADD CONSTRAINT employee_chat_threads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_dna_versions employee_dna_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_dna_versions employee_dna_versions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_dna_versions employee_dna_versions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_dna_versions employee_dna_versions_published_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_dna_versions
    ADD CONSTRAINT employee_dna_versions_published_by_user_id_fkey FOREIGN KEY (published_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_knowledge_sources employee_knowledge_sources_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_knowledge_sources employee_knowledge_sources_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_knowledge_sources employee_knowledge_sources_knowledge_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_knowledge_source_id_fkey FOREIGN KEY (knowledge_source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: employee_knowledge_sources employee_knowledge_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_sources
    ADD CONSTRAINT employee_knowledge_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_model_settings employee_model_settings_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_model_settings
    ADD CONSTRAINT employee_model_settings_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_model_settings employee_model_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_model_settings
    ADD CONSTRAINT employee_model_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_model_settings employee_model_settings_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_model_settings
    ADD CONSTRAINT employee_model_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: knowledge_documents knowledge_documents_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: knowledge_documents knowledge_documents_knowledge_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_knowledge_source_id_fkey FOREIGN KEY (knowledge_source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: knowledge_retrieval_segments knowledge_retrieval_segments_knowledge_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_retrieval_segments
    ADD CONSTRAINT knowledge_retrieval_segments_knowledge_document_id_fkey FOREIGN KEY (knowledge_document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_retrieval_segments knowledge_retrieval_segments_knowledge_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_retrieval_segments
    ADD CONSTRAINT knowledge_retrieval_segments_knowledge_source_id_fkey FOREIGN KEY (knowledge_source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: knowledge_retrieval_segments knowledge_retrieval_segments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_retrieval_segments
    ADD CONSTRAINT knowledge_retrieval_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: knowledge_sources knowledge_sources_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: knowledge_sources knowledge_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: llm_usage_events llm_usage_events_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage_events
    ADD CONSTRAINT llm_usage_events_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: llm_usage_events llm_usage_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage_events
    ADD CONSTRAINT llm_usage_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE SET NULL;


--
-- Name: llm_usage_events llm_usage_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage_events
    ADD CONSTRAINT llm_usage_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id);


--
-- Name: messages messages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messaging_contact_preferences messaging_contact_preferences_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_contact_preferences
    ADD CONSTRAINT messaging_contact_preferences_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE CASCADE;


--
-- Name: messaging_contact_preferences messaging_contact_preferences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_contact_preferences
    ADD CONSTRAINT messaging_contact_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messaging_templates messaging_templates_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE SET NULL;


--
-- Name: messaging_templates messaging_templates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: messaging_templates messaging_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_model_settings organization_model_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_model_settings
    ADD CONSTRAINT organization_model_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_model_settings organization_model_settings_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_model_settings
    ADD CONSTRAINT organization_model_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: organization_onboarding organization_onboarding_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_onboarding
    ADD CONSTRAINT organization_onboarding_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_onboarding organization_onboarding_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_onboarding
    ADD CONSTRAINT organization_onboarding_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_provider_credentials organization_provider_credentials_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_provider_credentials
    ADD CONSTRAINT organization_provider_credentials_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: organization_provider_credentials organization_provider_credentials_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_provider_credentials
    ADD CONSTRAINT organization_provider_credentials_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_provider_credentials organization_provider_credentials_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_provider_credentials
    ADD CONSTRAINT organization_provider_credentials_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: performance_criterion performance_criterion_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_criterion
    ADD CONSTRAINT performance_criterion_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: performance_criterion performance_criterion_scorecard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_criterion
    ADD CONSTRAINT performance_criterion_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.performance_scorecard(id) ON DELETE CASCADE;


--
-- Name: performance_review_case performance_review_case_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_case
    ADD CONSTRAINT performance_review_case_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: performance_review_case performance_review_case_scorecard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_case
    ADD CONSTRAINT performance_review_case_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.performance_scorecard(id) ON DELETE CASCADE;


--
-- Name: performance_review_result performance_review_result_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_result
    ADD CONSTRAINT performance_review_result_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.performance_review_case(id) ON DELETE CASCADE;


--
-- Name: performance_review_result performance_review_result_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_result
    ADD CONSTRAINT performance_review_result_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: performance_review_result performance_review_result_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_result
    ADD CONSTRAINT performance_review_result_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.performance_review_run(id) ON DELETE CASCADE;


--
-- Name: performance_review_run performance_review_run_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_run
    ADD CONSTRAINT performance_review_run_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: performance_review_run performance_review_run_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_run
    ADD CONSTRAINT performance_review_run_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: performance_review_run performance_review_run_scorecard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_run
    ADD CONSTRAINT performance_review_run_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.performance_scorecard(id) ON DELETE CASCADE;


--
-- Name: performance_review_run performance_review_run_started_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_review_run
    ADD CONSTRAINT performance_review_run_started_by_user_id_fkey FOREIGN KEY (started_by_user_id) REFERENCES public.users(id);


--
-- Name: performance_scorecard performance_scorecard_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_scorecard
    ADD CONSTRAINT performance_scorecard_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: performance_scorecard performance_scorecard_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_scorecard
    ADD CONSTRAINT performance_scorecard_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: public_channel_events public_channel_events_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_channel_events
    ADD CONSTRAINT public_channel_events_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE SET NULL;


--
-- Name: public_channel_events public_channel_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_channel_events
    ADD CONSTRAINT public_channel_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE SET NULL;


--
-- Name: public_channel_events public_channel_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_channel_events
    ADD CONSTRAINT public_channel_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: public_chat_sessions public_chat_sessions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_chat_sessions
    ADD CONSTRAINT public_chat_sessions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE CASCADE;


--
-- Name: public_chat_sessions public_chat_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_chat_sessions
    ADD CONSTRAINT public_chat_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: public_chat_sessions public_chat_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_chat_sessions
    ADD CONSTRAINT public_chat_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: public_chat_sessions public_chat_sessions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_chat_sessions
    ADD CONSTRAINT public_chat_sessions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.employee_chat_threads(id) ON DELETE SET NULL;


--
-- Name: usage_events usage_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE SET NULL;


--
-- Name: usage_events usage_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: voice_call_sessions voice_call_sessions_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_sessions
    ADD CONSTRAINT voice_call_sessions_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE CASCADE;


--
-- Name: voice_call_sessions voice_call_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_sessions
    ADD CONSTRAINT voice_call_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: voice_call_sessions voice_call_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_sessions
    ADD CONSTRAINT voice_call_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: voice_call_sessions voice_call_sessions_phone_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_sessions
    ADD CONSTRAINT voice_call_sessions_phone_number_id_fkey FOREIGN KEY (phone_number_id) REFERENCES public.voice_phone_numbers(id) ON DELETE SET NULL;


--
-- Name: voice_call_transcript_messages voice_call_transcript_messages_call_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_transcript_messages
    ADD CONSTRAINT voice_call_transcript_messages_call_session_id_fkey FOREIGN KEY (call_session_id) REFERENCES public.voice_call_sessions(id) ON DELETE CASCADE;


--
-- Name: voice_call_transcript_messages voice_call_transcript_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_transcript_messages
    ADD CONSTRAINT voice_call_transcript_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE CASCADE;


--
-- Name: voice_call_transcript_messages voice_call_transcript_messages_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_transcript_messages
    ADD CONSTRAINT voice_call_transcript_messages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: voice_call_transcript_messages voice_call_transcript_messages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_call_transcript_messages
    ADD CONSTRAINT voice_call_transcript_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: voice_phone_numbers voice_phone_numbers_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_phone_numbers
    ADD CONSTRAINT voice_phone_numbers_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE CASCADE;


--
-- Name: voice_phone_numbers voice_phone_numbers_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_phone_numbers
    ADD CONSTRAINT voice_phone_numbers_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: voice_phone_numbers voice_phone_numbers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_phone_numbers
    ADD CONSTRAINT voice_phone_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: voice_stream_events voice_stream_events_call_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_stream_events
    ADD CONSTRAINT voice_stream_events_call_session_id_fkey FOREIGN KEY (call_session_id) REFERENCES public.voice_call_sessions(id) ON DELETE CASCADE;


--
-- Name: voice_stream_events voice_stream_events_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_stream_events
    ADD CONSTRAINT voice_stream_events_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.employee_channels(id) ON DELETE SET NULL;


--
-- Name: voice_stream_events voice_stream_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_stream_events
    ADD CONSTRAINT voice_stream_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE SET NULL;


--
-- Name: voice_stream_events voice_stream_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_stream_events
    ADD CONSTRAINT voice_stream_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Workflows (Sprint 048). Applied by db/migrations/0028_workflows.sql. Appended
-- here to keep this snapshot complete; the migration remains the source of truth.
--

CREATE TABLE IF NOT EXISTS public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    trigger jsonb DEFAULT '{"type":"manual"}'::jsonb NOT NULL,
    graph jsonb DEFAULT '{"entryNodeId":null,"nodes":[]}'::jsonb NOT NULL,
    created_by_user_id uuid REFERENCES public.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.workflows (organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org_status ON public.workflows (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by_user_id ON public.workflows (created_by_user_id);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    status text DEFAULT 'running'::text NOT NULL,
    triggered_by text DEFAULT 'manual'::text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    output text,
    error text,
    step_count integer DEFAULT 0 NOT NULL,
    cursor_node_id text,
    created_by_user_id uuid REFERENCES public.users(id),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs (workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org ON public.workflow_runs (organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_by_user_id ON public.workflow_runs (created_by_user_id);

CREATE TABLE IF NOT EXISTS public.workflow_run_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    node_type text NOT NULL,
    employee_id uuid REFERENCES public.ai_employees(id) ON DELETE SET NULL,
    sequence integer NOT NULL,
    status text NOT NULL,
    input text,
    output text,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run ON public.workflow_run_steps (run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_org ON public.workflow_run_steps (organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_employee_id ON public.workflow_run_steps (employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_run_steps_run_seq ON public.workflow_run_steps (run_id, sequence);


--
-- PostgreSQL database dump complete
--

\unrestrict MrnQhPwFkffbRLQ21grLZ8VSsrGMZeAdLbWTdJw39fii6zajts2ry2TdM7L927P

