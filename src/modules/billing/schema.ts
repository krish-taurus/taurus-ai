/**
 * Billing input validation (Prompt 011).
 *
 * Only the plan id is ever accepted from the client, and it must be one of the
 * catalog ids. The organization is always resolved server-side from the session
 * — never taken from client input — so a client can never select another org's
 * plan.
 */

import { z } from "zod";
import { PLAN_IDS } from "@/modules/billing/plans";

export const choosePlanSchema = z.object({
  planId: z.enum(PLAN_IDS),
});

export type ChoosePlanValues = z.infer<typeof choosePlanSchema>;
