import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { AiEmployee } from "@/lib/db/types";

/**
 * Batch 4 — error-surfacing hardening. These controls previously discarded their
 * server-action result (`const [, action]` / `catch {}`), so a permission-denied
 * or failed mutation showed nothing. They now render `state.error`.
 *
 * The React form-action renderer isn't available in jsdom, so we stub
 * useFormState/useFormStatus (same approach as model-hub-byok-ui.test.tsx) and
 * inject a state to prove the component reflects it. The actions are only
 * referenced, never invoked.
 */
const h = vi.hoisted(() => ({
  state: {} as { error?: string; ok?: boolean },
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (_action: unknown, initial: unknown) => [h.state ?? initial, () => {}],
    useFormStatus: () => ({ pending: false }),
  };
});

import { EmployeeActions } from "@/components/employees/employee-actions";
import { ArchiveVersionButton } from "@/components/employee-dna/archive-version-button";
import { AssignVaultButton } from "@/components/knowledge/assign-knowledge-button";
import { KnowledgeSourceActions } from "@/components/knowledge/knowledge-source-actions";
import { VoiceStatusControls } from "@/components/channels/voice/voice-status-controls";
import { PrepareKnowledgeButton } from "@/components/employee-chat/prepare-knowledge-button";

function employee(overrides: Partial<AiEmployee> = {}): AiEmployee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    name: "Maya",
    roleTitle: "Support",
    department: null,
    description: null,
    status: "active",
    visibility: "private",
    responsibilities: [],
    workingStyle: null,
    avatarUrl: null,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const knowledgeSource = {
  id: "src-1",
  name: "Handbook",
  status: "ready" as const,
};

beforeEach(() => {
  h.state = {};
});

describe("Error-surfacing on lifecycle controls (Batch 4)", () => {
  it("EmployeeActions renders controls and no error by default", () => {
    const { container } = render(<EmployeeActions employee={employee()} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Pause");
    expect(text).toContain("Archive");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("EmployeeActions surfaces a failed transition message", () => {
    h.state = { error: "You do not have permission to change this AI Employee." };
    const { container } = render(<EmployeeActions employee={employee()} />);
    expect(container.textContent).toContain("do not have permission");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("ArchiveVersionButton surfaces its error", () => {
    h.state = { error: "Could not archive this version." };
    const { container } = render(<ArchiveVersionButton employeeId="emp-1" versionId="v-1" />);
    expect(container.textContent).toContain("Could not archive this version.");
  });

  it("AssignVaultButton labels by assignment and surfaces its error", () => {
    h.state = { error: "Could not assign this vault." };
    const assign = render(
      <AssignVaultButton employeeId="emp-1" vaultId="vault-1" assigned={false} />,
    );
    expect(assign.container.textContent).toContain("Assign");
    expect(assign.container.textContent).toContain("Could not assign this vault.");

    const remove = render(<AssignVaultButton employeeId="emp-1" vaultId="vault-1" assigned />);
    expect(remove.container.textContent).toContain("Remove");
  });

  it("KnowledgeSourceActions surfaces an archive error", () => {
    h.state = { error: "Could not archive this knowledge." };
    const { container } = render(<KnowledgeSourceActions source={knowledgeSource as never} />);
    expect(container.textContent).toContain("Could not archive this knowledge.");
  });

  it("VoiceStatusControls surfaces an action error", () => {
    h.state = { error: "You do not have permission to manage this Voice Channel." };
    const { container } = render(
      <VoiceStatusControls employeeId="emp-1" channelId="chan-1" status="active" />,
    );
    expect(container.textContent).toContain("do not have permission");
  });

  it("PrepareKnowledgeButton surfaces error and success states", () => {
    h.state = { error: "Something went wrong." };
    const errored = render(<PrepareKnowledgeButton employeeId="emp-1" hasPrepared={false} />);
    expect(errored.container.textContent).toContain("Something went wrong.");

    h.state = { ok: true };
    const ok = render(<PrepareKnowledgeButton employeeId="emp-1" hasPrepared />);
    expect(ok.container.textContent).toContain("Knowledge prepared.");
  });
});
