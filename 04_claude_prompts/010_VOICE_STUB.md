# Prompt 010: Voice Provisioning Stub

## Objective

Add voice settings foundation without implementing full real-time voice.

## Requirements

Add voice settings fields:

- voice_enabled
- voice_provider
- voice_id
- speaking_style
- language
- phone_number placeholder
- web_voice_enabled

## UI

Add Voice tab to Employee Card.

Show:

- enable voice toggle,
- choose voice placeholder,
- test voice placeholder,
- coming soon note for phone deployment.

## Provider interface

```ts
export interface VoiceProvider {
  transcribe(input: SpeechToTextInput): Promise<TranscriptResult>;
  synthesize(input: TextToSpeechInput): Promise<AudioResult>;
}
```

## Acceptance criteria

- Voice settings can be saved.
- Voice is presented as a channel for the employee.
- No provider keys are exposed.
