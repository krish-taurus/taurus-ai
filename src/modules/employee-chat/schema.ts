/**
 * Employee Chat validation (Prompt 007).
 */

import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please type a message.")
    .max(4000, "That message is a bit long — please shorten it."),
});

export type ChatMessageValues = z.infer<typeof chatMessageSchema>;
