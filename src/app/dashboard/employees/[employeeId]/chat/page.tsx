import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getModel } from "@/modules/model-gateway/catalog";
import { computeChatReadiness } from "@/modules/employee-chat/readiness";
import {
  ChatConversation,
  type ChatMessageView,
} from "@/components/employee-chat/chat-conversation";
import { ChatReadinessGate } from "@/components/employee-chat/chat-readiness-gate";
import { PrepareKnowledgeButton } from "@/components/employee-chat/prepare-knowledge-button";
import { Badge, buttonClasses, Notice, PageHeader } from "@/components/ui";

export default async function EmployeeChatPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee_chat.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const readiness = await computeChatReadiness(store, {
    organizationId: organization.id,
    employee,
  });

  const thread = await store.getLatestEmployeeChatThreadForEmployee(organization.id, employee.id);
  const rawMessages = thread
    ? await store.listEmployeeChatMessages(organization.id, thread.id)
    : [];

  const messages: ChatMessageView[] = rawMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      status: m.status,
      sourceReferences: m.sourceReferences,
      brainLabel:
        m.role === "assistant"
          ? m.brainMode === "local_demo"
            ? "Local demo brain"
            : m.modelId
              ? (getModel(m.modelId)?.displayName ?? "Employee Brain")
              : "Employee Brain"
          : null,
      demo: m.brainMode === "local_demo",
    }));

  const dnaStatus = readiness.dnaPublished ? "DNA published" : "DNA not published";

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← {employee.name}
        </Link>
      </p>

      <PageHeader
        eyebrow="Employee Chat"
        title={`Chat with ${employee.name}`}
        description={`${employee.roleTitle}${employee.department ? ` · ${employee.department}` : ""}`}
        action={
          <PrepareKnowledgeButton
            employeeId={employee.id}
            hasPrepared={readiness.preparedExcerptCount > 0}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="soft">{employee.status === "active" ? "Active" : "Draft"}</Badge>
        <Badge tone="outline">{dnaStatus}</Badge>
        <Badge tone="outline">
          {readiness.assignedKnowledgeCount} knowledge{" "}
          {readiness.assignedKnowledgeCount === 1 ? "source" : "sources"}
        </Badge>
        {readiness.brainMode === "live" ? (
          <Badge tone="solid">Live brain</Badge>
        ) : readiness.brainMode === "local_demo" ? (
          <Badge tone="outline">Local demo mode</Badge>
        ) : null}
      </div>

      {readiness.canChat && readiness.assignedKnowledgeCount === 0 ? (
        <div className="mb-4">
          <Notice>
            This AI Employee has no assigned Knowledge Vault sources yet. It will answer from its
            Employee DNA and say when it lacks company knowledge.{" "}
            <Link
              href={`/dashboard/employees/${employee.id}/knowledge`}
              className="font-medium underline underline-offset-2"
            >
              Assign Knowledge
            </Link>
          </Notice>
        </div>
      ) : null}

      {readiness.canChat &&
      readiness.assignedKnowledgeCount > 0 &&
      readiness.preparedExcerptCount === 0 ? (
        <div className="mb-4">
          <Notice>
            Assigned knowledge hasn&apos;t been prepared for chat yet. Use “Prepare knowledge” so
            answers can be grounded in your sources.
          </Notice>
        </div>
      ) : null}

      {readiness.canChat ? (
        <ChatConversation
          employeeId={employee.id}
          employeeName={employee.name}
          threadId={thread?.id ?? null}
          messages={messages}
        />
      ) : (
        <ChatReadinessGate reason={readiness.blockReason ?? "needs_dna"} employeeId={employee.id} />
      )}

      <p className="mt-4 text-center text-xs text-taurus-faint">
        Responses are generated for testing.{" "}
        <Link href="/dashboard/settings/models" className="underline underline-offset-2">
          Model Hub
        </Link>{" "}
        controls which Employee Brain is used.
      </p>
    </div>
  );
}
