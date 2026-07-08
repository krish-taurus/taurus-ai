-- Sprint 020 follow-up — foreign-key index coverage (data integrity + compliance).
--
-- A full-schema audit of a freshly migrated database found 45 tables (all with
-- primary keys) and 109 foreign keys, but 36 foreign-key columns had no
-- supporting index. Unindexed FK columns are a well-known integrity/performance
-- gap: every delete of a referenced parent row must sequentially scan the child
-- table to enforce the constraint (and to run ON DELETE CASCADE / SET NULL), and
-- lookups/joins on those columns are slow. Indexing them keeps referential
-- integrity operations fast and predictable as data grows.
--
-- Purely additive and idempotent (create index if not exists): no schema or
-- behavior change, so existing databases and app features are unaffected. Names
-- follow idx_<table>_<column>. (Plain CREATE INDEX, not CONCURRENTLY, because the
-- migration runner wraps each file in a transaction; safe at SMB data scale.)

create index if not exists idx_ai_employees_created_by on ai_employees (created_by);
create index if not exists idx_channel_provider_credentials_created_by_user_id on channel_provider_credentials (created_by_user_id);
create index if not exists idx_channel_provider_credentials_updated_by_user_id on channel_provider_credentials (updated_by_user_id);
create index if not exists idx_collaboration_requests_created_by on collaboration_requests (created_by);
create index if not exists idx_collaboration_requests_requesting_employee_id on collaboration_requests (requesting_employee_id);
create index if not exists idx_collaboration_requests_responding_employee_id on collaboration_requests (responding_employee_id);
create index if not exists idx_conversations_user_id on conversations (user_id);
create index if not exists idx_employee_channels_created_by_user_id on employee_channels (created_by_user_id);
create index if not exists idx_employee_chat_messages_created_by_user_id on employee_chat_messages (created_by_user_id);
create index if not exists idx_employee_chat_retrieval_events_message_id on employee_chat_retrieval_events (message_id);
create index if not exists idx_employee_chat_threads_created_by_user_id on employee_chat_threads (created_by_user_id);
create index if not exists idx_employee_dna_versions_created_by_user_id on employee_dna_versions (created_by_user_id);
create index if not exists idx_employee_dna_versions_published_by_user_id on employee_dna_versions (published_by_user_id);
create index if not exists idx_employee_knowledge_sources_assigned_by_user_id on employee_knowledge_sources (assigned_by_user_id);
create index if not exists idx_employee_model_settings_updated_by_user_id on employee_model_settings (updated_by_user_id);
create index if not exists idx_knowledge_documents_created_by_user_id on knowledge_documents (created_by_user_id);
create index if not exists idx_knowledge_sources_created_by_user_id on knowledge_sources (created_by_user_id);
create index if not exists idx_llm_usage_events_created_by_user_id on llm_usage_events (created_by_user_id);
create index if not exists idx_messages_employee_id on messages (employee_id);
create index if not exists idx_messages_organization_id on messages (organization_id);
create index if not exists idx_messaging_templates_created_by_user_id on messaging_templates (created_by_user_id);
create index if not exists idx_organization_model_settings_updated_by_user_id on organization_model_settings (updated_by_user_id);
create index if not exists idx_organization_onboarding_updated_by_user_id on organization_onboarding (updated_by_user_id);
create index if not exists idx_organization_provider_credentials_created_by_user_id on organization_provider_credentials (created_by_user_id);
create index if not exists idx_organization_provider_credentials_updated_by_user_id on organization_provider_credentials (updated_by_user_id);
create index if not exists idx_performance_review_result_case_id on performance_review_result (case_id);
create index if not exists idx_performance_review_run_scorecard_id on performance_review_run (scorecard_id);
create index if not exists idx_performance_review_run_started_by_user_id on performance_review_run (started_by_user_id);
create index if not exists idx_performance_scorecard_created_by_user_id on performance_scorecard (created_by_user_id);
create index if not exists idx_public_chat_sessions_thread_id on public_chat_sessions (thread_id);
create index if not exists idx_usage_events_employee_id on usage_events (employee_id);
create index if not exists idx_voice_call_sessions_phone_number_id on voice_call_sessions (phone_number_id);
create index if not exists idx_voice_call_transcript_messages_channel_id on voice_call_transcript_messages (channel_id);
create index if not exists idx_voice_call_transcript_messages_employee_id on voice_call_transcript_messages (employee_id);
create index if not exists idx_voice_phone_numbers_created_by_user_id on voice_phone_numbers (created_by_user_id);
create index if not exists idx_voice_stream_events_channel_id on voice_stream_events (channel_id);
create index if not exists idx_voice_stream_events_employee_id on voice_stream_events (employee_id);
