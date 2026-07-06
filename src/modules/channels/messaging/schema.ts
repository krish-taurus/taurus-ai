/**
 * Messaging channel validation (Prompt 009).
 */

import { z } from "zod";

export const messagingChannelTypeSchema = z.enum(["whatsapp", "sms", "email"]);
export const messagingProviderSchema = z.enum([
  "twilio",
  "meta_whatsapp_cloud",
  "sendgrid",
  "mailgun",
  "custom_webhook",
]);

export const createMessagingChannelSchema = z.object({
  channelType: messagingChannelTypeSchema,
  provider: messagingProviderSchema,
  name: z.string().trim().min(1, "Please name this channel.").max(80),
  senderId: z.string().trim().max(200).optional().or(z.literal("")),
});

export const updateMessagingChannelSchema = z.object({
  name: z.string().trim().min(1, "Please name this channel.").max(80),
  senderId: z.string().trim().max(200).optional().or(z.literal("")),
  domain: z.string().trim().max(200).optional().or(z.literal("")),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
});

export const simulateInboundSchema = z.object({
  from: z.string().trim().min(1, "Please enter a sender.").max(200),
  text: z.string().trim().min(1, "Please enter a message.").max(2000),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export type CreateMessagingChannelValues = z.infer<typeof createMessagingChannelSchema>;
export type UpdateMessagingChannelValues = z.infer<typeof updateMessagingChannelSchema>;
export type SimulateInboundValues = z.infer<typeof simulateInboundSchema>;
