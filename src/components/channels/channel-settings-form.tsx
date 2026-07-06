"use client";

/**
 * Channel settings form (Prompt 008): name, welcome message, allowed domains,
 * appearance, and rate limits. All values are re-validated server-side.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { EmployeeChannel } from "@/lib/db/types";
import { updateChannelAction, type ChannelActionState } from "@/modules/channels/actions";
import {
  buttonClasses,
  Field,
  FieldError,
  FormSection,
  Input,
  Notice,
  Select,
  Textarea,
} from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : "Save channel settings"}
    </button>
  );
}

export function ChannelSettingsForm({
  employeeId,
  channel,
}: {
  employeeId: string;
  channel: EmployeeChannel;
}) {
  const [state, formAction] = useFormState(updateChannelAction, {} as ChannelActionState);
  const a = channel.appearance;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="channelId" value={channel.id} />

      <FormSection title="Basics" description="How this channel introduces your AI Employee.">
        <Field label="Channel name" htmlFor="name">
          <Input id="name" name="name" defaultValue={channel.name} required maxLength={80} />
        </Field>
        <Field label="Welcome message" htmlFor="welcomeMessage" optional>
          <Textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={2}
            defaultValue={channel.welcomeMessage ?? ""}
            maxLength={500}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Allowed websites"
        description="Domains allowed to use the widget and API. One per line. Leave empty to allow only the hosted link (widget/API need a domain in production)."
      >
        <Textarea
          name="allowedDomains"
          rows={3}
          defaultValue={channel.allowedDomains.join("\n")}
          placeholder={"example.com\nwww.example.com"}
        />
      </FormSection>

      <FormSection title="Appearance" description="How the chat looks on your site.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Theme" htmlFor="theme">
            <Select id="theme" name="theme" defaultValue={a.theme}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </Field>
          <Field label="Launcher position" htmlFor="position">
            <Select id="position" name="position" defaultValue={a.position}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </Select>
          </Field>
          <Field label="Launcher label" htmlFor="launcherLabel">
            <Input
              id="launcherLabel"
              name="launcherLabel"
              defaultValue={a.launcherLabel}
              maxLength={60}
            />
          </Field>
          <Field label="Display name" htmlFor="employeeDisplayName">
            <Input
              id="employeeDisplayName"
              name="employeeDisplayName"
              defaultValue={a.employeeDisplayName}
              maxLength={80}
            />
          </Field>
          <Field label="Accent" htmlFor="accentStyle">
            <Select id="accentStyle" name="accentStyle" defaultValue={a.accentStyle}>
              <option value="mono">Monochrome</option>
              <option value="solid">Solid</option>
            </Select>
          </Field>
          <Field label="Brand name" htmlFor="brandName" optional>
            <Input
              id="brandName"
              name="brandName"
              defaultValue={a.brandName ?? ""}
              maxLength={80}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-taurus-text">
          <input type="checkbox" name="showSources" defaultChecked={a.showSources} />
          Show the sources used in answers
        </label>
        <label className="flex items-center gap-2 text-sm text-taurus-faint">
          <input
            type="checkbox"
            name="collectVisitorEmail"
            defaultChecked={a.collectVisitorEmail}
          />
          Collect visitor email (coming soon — not active yet)
        </label>
      </FormSection>

      <FormSection title="Rate limits" description="Protect against abuse.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Messages per minute" htmlFor="rateLimitPerMinute">
            <Input
              id="rateLimitPerMinute"
              name="rateLimitPerMinute"
              type="number"
              min={1}
              max={240}
              defaultValue={channel.rateLimitPerMinute}
            />
          </Field>
          <Field label="Messages per day" htmlFor="rateLimitPerDay">
            <Input
              id="rateLimitPerDay"
              name="rateLimitPerDay"
              type="number"
              min={1}
              max={100000}
              defaultValue={channel.rateLimitPerDay}
            />
          </Field>
        </div>
      </FormSection>

      {state?.ok ? <Notice>Channel settings saved.</Notice> : null}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <SubmitButton />
    </form>
  );
}
