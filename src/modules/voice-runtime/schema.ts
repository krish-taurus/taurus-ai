/**
 * Voice channel validation (Prompt 010).
 */

import { z } from "zod";

export const voiceProviderSchema = z.enum([
  "simulated_voice",
  "twilio_voice",
  "telnyx_voice",
  "vonage_voice",
]);

/** Voice providers that accept bring-your-own-key credentials. */
export const voiceCredentialProviderSchema = z.enum([
  "twilio_voice",
  "telnyx_voice",
  "vonage_voice",
]);

/** Validated inputs for saving / disabling a voice provider credential. The
 * secret fields themselves are provider-specific and validated in the service
 * (required-field checks); here we validate the provider and label. */
export const saveVoiceCredentialSchema = z.object({
  providerType: voiceCredentialProviderSchema,
  label: z.string().trim().max(80, "Keep the label under 80 characters.").optional(),
});

export const disableVoiceCredentialSchema = z.object({
  providerType: voiceCredentialProviderSchema,
});

const voiceConfigFields = {
  voiceStyle: z.enum(["Professional", "Warm", "Direct", "Luxury", "Friendly"]),
  sttProvider: z.string().trim().max(40),
  ttsProvider: z.string().trim().max(40),
  recordingSetting: z.enum(["disabled", "metadata_only", "full_recording_coming_soon"]),
  transcriptSetting: z.enum(["save_transcript", "do_not_save"]),
  businessHours: z.string().trim().max(200).optional().or(z.literal("")),
  escalationNote: z.string().trim().max(500).optional().or(z.literal("")),
};

export const createVoiceChannelSchema = z.object({
  name: z.string().trim().min(1, "Please name this channel.").max(80),
  provider: voiceProviderSchema,
  phoneNumber: z.string().trim().max(40).optional().or(z.literal("")),
  phoneNumberLabel: z.string().trim().max(80).optional().or(z.literal("")),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
  ...voiceConfigFields,
});

export const updateVoiceChannelSchema = z.object({
  name: z.string().trim().min(1, "Please name this channel.").max(80),
  phoneNumber: z.string().trim().max(40).optional().or(z.literal("")),
  phoneNumberLabel: z.string().trim().max(80).optional().or(z.literal("")),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
  ...voiceConfigFields,
});

export const simulateStartSchema = z.object({
  from: z.string().trim().min(1, "Please enter a caller number.").max(40),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export const simulateUtteranceSchema = z.object({
  callSessionId: z.string().trim().min(1),
  text: z.string().trim().min(1, "Please enter what the caller says.").max(2000),
});

export type CreateVoiceChannelValues = z.infer<typeof createVoiceChannelSchema>;
export type UpdateVoiceChannelValues = z.infer<typeof updateVoiceChannelSchema>;
