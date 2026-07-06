# Voice Foundation

## Product Position

Voice is a channel for AI Employees.

It is not the core product.

## MVP Decision

Phase 1 should include a voice provisioning stub, not full production voice infrastructure.

## Voice Settings

Add voice settings to employee later:

- voice_enabled
- voice_provider
- voice_id
- speaking_style
- language
- phone_number placeholder
- web_voice_enabled

## Provider Interface

```ts
export interface VoiceProvider {
  transcribe(input: SpeechToTextInput): Promise<TranscriptResult>;
  synthesize(input: TextToSpeechInput): Promise<AudioResult>;
}
```

## Future Voice Requirements

- streaming speech-to-text,
- streaming text-to-speech,
- interruption handling,
- low latency,
- phone support,
- browser voice support,
- call recordings,
- transcript storage,
- consent messages,
- channel-specific analytics.

## Security Requirements

- voice transcripts are organization-scoped,
- recordings must be configurable,
- user consent requirements should be respected based on customer region,
- sensitive calls require audit events.
