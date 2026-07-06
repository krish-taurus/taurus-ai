/**
 * Channel management service (Prompt 008) — server only.
 *
 * Dashboard create/update/activate/pause/archive for channels, with metadata-only
 * audit + channel events. Validates against the catalog and never stores secrets
 * in provider_config.
 */

import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { generatePublicKey } from "@/modules/channels/keys";
import { defaultAppearance } from "@/modules/channels/appearance";
import { WEB_CHANNEL_TYPE } from "@/modules/channels/catalog";
import { createWebChannelSchema, updateChannelSchema } from "@/modules/channels/schema";

export interface ChannelActor {
  organizationId: string;
  userId: string;
}

export class ChannelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelValidationError";
  }
}

async function recordChannelChange(
  store: DataStore,
  actor: ChannelActor,
  channel: EmployeeChannel,
  action:
    | "channel.created"
    | "channel.updated"
    | "channel.activated"
    | "channel.paused"
    | "channel.archived",
): Promise<void> {
  // Audit (dashboard) + channel event (deployment) — both metadata only.
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action,
    targetType: "employee_channel",
    targetId: channel.id,
    metadata: {
      employeeId: channel.employeeId,
      channelId: channel.id,
      channelType: channel.channelType,
      status: channel.status,
    },
  });
  await store.createPublicChannelEvent({
    organizationId: actor.organizationId,
    employeeId: channel.employeeId,
    channelId: channel.id,
    eventType: action,
    metadata: { channelType: channel.channelType, status: channel.status },
  });
}

/** Create the single web channel that powers all web surfaces for an employee. */
export async function createWebChannel(
  store: DataStore,
  actor: ChannelActor,
  employee: AiEmployee,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = createWebChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new ChannelValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }

  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType: WEB_CHANNEL_TYPE,
    channelProvider: "taurus_web",
    publicKey: generatePublicKey(),
    name: parsed.data.name || "Website",
    status: "draft",
    allowedDomains: [],
    appearance: defaultAppearance(employee),
    providerConfig: {},
    welcomeMessage:
      parsed.data.welcomeMessage ||
      `Hi! I'm ${employee.name}. Ask me anything and I'll do my best to help.`,
    createdByUserId: actor.userId,
  });

  await recordChannelChange(store, actor, channel, "channel.created");
  return channel;
}

/** Update a channel's name, welcome message, domains, appearance, and limits. */
export async function updateChannel(
  store: DataStore,
  actor: ChannelActor,
  channelId: string,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = updateChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new ChannelValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }
  const values = parsed.data;

  const updated = await store.updateEmployeeChannel(actor.organizationId, channelId, {
    name: values.name,
    welcomeMessage: values.welcomeMessage || null,
    allowedDomains: values.allowedDomains,
    appearance: values.appearance,
    rateLimitPerMinute: values.rateLimitPerMinute,
    rateLimitPerDay: values.rateLimitPerDay,
  });
  if (!updated) throw new ChannelValidationError("Channel not found.");

  await recordChannelChange(store, actor, updated, "channel.updated");
  return updated;
}

async function transition(
  store: DataStore,
  actor: ChannelActor,
  channelId: string,
  op: "activate" | "pause" | "archive",
): Promise<EmployeeChannel> {
  const updated =
    op === "activate"
      ? await store.activateEmployeeChannel(actor.organizationId, channelId)
      : op === "pause"
        ? await store.pauseEmployeeChannel(actor.organizationId, channelId)
        : await store.archiveEmployeeChannel(actor.organizationId, channelId);
  if (!updated) throw new ChannelValidationError("Channel not found.");

  const action =
    op === "activate"
      ? "channel.activated"
      : op === "pause"
        ? "channel.paused"
        : "channel.archived";
  await recordChannelChange(store, actor, updated, action);
  return updated;
}

export function activateChannel(store: DataStore, actor: ChannelActor, channelId: string) {
  return transition(store, actor, channelId, "activate");
}
export function pauseChannel(store: DataStore, actor: ChannelActor, channelId: string) {
  return transition(store, actor, channelId, "pause");
}
export function archiveChannel(store: DataStore, actor: ChannelActor, channelId: string) {
  return transition(store, actor, channelId, "archive");
}
