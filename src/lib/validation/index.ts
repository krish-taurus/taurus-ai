/**
 * Shared validation helpers (Prompt 001 placeholder).
 *
 * Taurus AI validates all external input with Zod schemas at the boundary.
 * Feature-specific schemas live with their modules; cross-cutting primitives
 * (ids, pagination, etc.) will be collected here as they are introduced.
 */

import { z } from "zod";

/** UUID identifier used for primary keys across tenant-scoped tables. */
export const uuidSchema = z.string().uuid();

/** Non-empty, trimmed display name. */
export const nameSchema = z.string().trim().min(1).max(120);

export type Uuid = z.infer<typeof uuidSchema>;
