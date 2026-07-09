import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { hasPermission } from "@/modules/organizations/roles";
import {
  archiveSource,
  assignKnowledgeToEmployee,
  createCloudStorageSource,
  createDatabaseSource,
  createFileSource,
  createGoogleDriveSource,
  createTextSource,
  createUrlSource,
  getVaultOverview,
  KnowledgeNotFoundError,
  KnowledgeValidationError,
  syncCloudStorageSource,
  syncDatabaseSource,
  syncGoogleDriveSource,
  unassignKnowledgeFromEmployee,
  validateUpload,
  type KnowledgeStorage,
} from "@/modules/knowledge/service";

class FakeStorage implements KnowledgeStorage {
  saved: { organizationId: string; storageKey: string; bytes: Uint8Array }[] = [];
  async save(input: { organizationId: string; storageKey: string; bytes: Uint8Array }) {
    this.saved.push(input);
  }
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function setup() {
  const store = new InMemoryStore();
  const alice = await store.createUser({ email: "alice@example.com", fullName: "Alice" });
  const bob = await store.createUser({ email: "bob@example.com", fullName: "Bob" });
  const aliceOrg = (await createOrganizationForUser(store, alice.id, { name: "Alice Co" }))
    .organization;
  const bobOrg = (await createOrganizationForUser(store, bob.id, { name: "Bob Co" })).organization;
  const employee = await store.createEmployee({
    organizationId: aliceOrg.id,
    name: "Maya",
    roleTitle: "Support AI",
  });
  return { store, alice, bob, aliceOrg, bobOrg, employee };
}

const actor = (organizationId: string, userId: string) => ({ organizationId, userId });

describe("Knowledge Vault validation", () => {
  it("requires a name", async () => {
    const { store, alice, aliceOrg } = await setup();
    await expect(
      createTextSource(store, actor(aliceOrg.id, alice.id), { name: "A", text: "hello" }),
    ).rejects.toBeInstanceOf(KnowledgeValidationError);
  });

  it("requires text content for a text source", async () => {
    const { store, alice, aliceOrg } = await setup();
    await expect(
      createTextSource(store, actor(aliceOrg.id, alice.id), { name: "Policy", text: "" }),
    ).rejects.toBeInstanceOf(KnowledgeValidationError);
  });

  it("rejects non-http(s) and malformed URLs", async () => {
    const { store, alice, aliceOrg } = await setup();
    const noFetch = { text: null, status: "failed" as const };
    await expect(
      createUrlSource(
        store,
        actor(aliceOrg.id, alice.id),
        { name: "Site", url: "ftp://x.com" },
        noFetch,
      ),
    ).rejects.toBeInstanceOf(KnowledgeValidationError);
    await expect(
      createUrlSource(
        store,
        actor(aliceOrg.id, alice.id),
        { name: "Site", url: "not a url" },
        noFetch,
      ),
    ).rejects.toBeInstanceOf(KnowledgeValidationError);
  });

  it("validates upload type, empty, and size", () => {
    expect(() =>
      validateUpload({ originalFilename: "a.exe", contentType: null, bytes: bytes("x") }),
    ).toThrow(KnowledgeValidationError);
    expect(() =>
      validateUpload({ originalFilename: "a.txt", contentType: null, bytes: new Uint8Array(0) }),
    ).toThrow(KnowledgeValidationError);
    const big = new Uint8Array(11 * 1024 * 1024);
    expect(() =>
      validateUpload({ originalFilename: "a.txt", contentType: null, bytes: big }),
    ).toThrow(KnowledgeValidationError);
    expect(
      validateUpload({ originalFilename: "a.txt", contentType: null, bytes: bytes("x") }).extension,
    ).toBe(".txt");
  });
});

describe("manual text source", () => {
  it("creates a ready text source with extracted document + preview", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Refund policy",
      description: "How refunds work",
      text: "Refunds are processed within 14 days.",
    });

    expect(source.sourceType).toBe("text");
    expect(source.status).toBe("ready");

    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].extractionStatus).toBe("extracted");
    expect(docs[0].textContent).toContain("Refunds are processed");
    expect(docs[0].textPreview).toContain("Refunds are processed");
    expect(store._auditEvents().some((e) => e.action === "knowledge_source.created")).toBe(true);
  });
});

describe("website URL source", () => {
  it("stores fetched page text as a ready, searchable document", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createUrlSource(
      store,
      actor(aliceOrg.id, alice.id),
      { name: "Help center", url: "https://example.com/help" },
      { text: "Our return policy is 30 days.", status: "extracted" },
    );
    expect(source.sourceType).toBe("url");
    expect(source.status).toBe("ready");
    expect(source.metadata.url).toBe("https://example.com/help");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].extractionStatus).toBe("extracted");
    expect(docs[0].textContent).toContain("return policy is 30 days");
  });

  it("saves the record but flags it when the page could not be read", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createUrlSource(
      store,
      actor(aliceOrg.id, alice.id),
      { name: "Broken", url: "https://example.com/nope" },
      { text: null, status: "failed" },
    );
    expect(source.status).toBe("failed");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs[0].textContent).toBeNull();
    expect(docs[0].extractionStatus).toBe("failed");
  });
});

describe("file source", () => {
  it("extracts text for .txt and marks ready", async () => {
    const { store, alice, aliceOrg } = await setup();
    const storage = new FakeStorage();
    const source = await createFileSource(store, storage, actor(aliceOrg.id, alice.id), {
      meta: { name: "Notes" },
      file: {
        originalFilename: "notes.txt",
        contentType: "text/plain",
        bytes: bytes("hello team"),
      },
      extraction: { text: "hello team", status: "extracted" },
    });
    expect(source.status).toBe("ready");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs[0].extractionStatus).toBe("extracted");
    expect(docs[0].textContent).toBe("hello team");
    expect(docs[0].storageKey).toBeTruthy();
    expect(docs[0].storageKey).not.toContain("notes.txt"); // opaque key, not raw filename
    expect(storage.saved).toHaveLength(1);
    expect(docs[0].checksumSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores an extracted .pdf as a ready, searchable document", async () => {
    const { store, alice, aliceOrg } = await setup();
    const storage = new FakeStorage();
    const source = await createFileSource(store, storage, actor(aliceOrg.id, alice.id), {
      meta: { name: "Handbook" },
      file: {
        originalFilename: "handbook.pdf",
        contentType: "application/pdf",
        bytes: bytes("%PDF-1.4 ..."),
      },
      extraction: { text: "The handbook explains our onboarding.", status: "extracted" },
    });
    expect(source.status).toBe("ready");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs[0].extractionStatus).toBe("extracted");
    expect(docs[0].textContent).toContain("onboarding");
  });

  it("still saves a file whose text could not be read, flagged for attention", async () => {
    const { store, alice, aliceOrg } = await setup();
    const storage = new FakeStorage();
    const source = await createFileSource(store, storage, actor(aliceOrg.id, alice.id), {
      meta: { name: "Scanned" },
      file: {
        originalFilename: "scan.pdf",
        contentType: "application/pdf",
        bytes: bytes("%PDF-1.4 scanned image"),
      },
      extraction: { text: null, status: "failed" },
    });
    expect(source.status).toBe("uploaded");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs[0].extractionStatus).toBe("failed");
    expect(docs[0].textContent).toBeNull();
  });
});

describe("database source", () => {
  const connector = {
    kind: "postgres" as const,
    displayHost: "db.example.com:5432",
    query: "select question, answer from faqs",
    connectionEncrypted: "ENC(postgres://readonly@db.example.com/app)",
  };

  it("stores query results as a ready, searchable document", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createDatabaseSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Product FAQ" },
      connector,
      result: { text: "question: Return policy?\nanswer: 30 days", status: "extracted", rowCount: 1 },
    });
    expect(source.sourceType).toBe("database");
    expect(source.status).toBe("ready");
    // The connection secret is only stored as ciphertext, never in plaintext.
    expect(source.metadata.connectionEncrypted).toBe(connector.connectionEncrypted);
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].textContent).toContain("30 days");
    expect(docs[0].extractionStatus).toBe("extracted");
  });

  it("re-syncs by replacing the document with fresh rows", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createDatabaseSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Product FAQ" },
      connector,
      result: { text: "answer: 30 days", status: "extracted", rowCount: 1 },
    });
    await syncDatabaseSource(store, actor(aliceOrg.id, alice.id), source.id, {
      text: "answer: 45 days",
      status: "extracted",
      rowCount: 1,
    });
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1); // replaced, not duplicated
    expect(docs[0].textContent).toContain("45 days");
    expect(store._auditEvents().some((e) => e.action === "knowledge_source.synced")).toBe(true);
  });
});

describe("google drive source", () => {
  const connector = {
    email: "owner@example.com",
    rootId: "1AbCfolder",
    rootName: "Sales playbooks",
    connectionEncrypted: "ENC(refresh-token)",
  };

  it("stores one document per Drive file and marks the source ready", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createGoogleDriveSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Sales playbooks" },
      connector,
      documents: [
        { title: "Pricing.pdf", text: "Enterprise pricing is custom.", status: "extracted" },
        { title: "Old.key", text: null, status: "unsupported" },
      ],
      skipped: 1,
    });
    expect(source.sourceType).toBe("google_drive");
    expect(source.status).toBe("ready");
    // The refresh token is only stored as ciphertext, never in plaintext.
    expect(source.metadata.connectionEncrypted).toBe(connector.connectionEncrypted);
    expect(source.metadata.email).toBe("owner@example.com");
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(2);
    expect(docs.some((d) => d.textContent?.includes("Enterprise pricing"))).toBe(true);
  });

  it("marks the source failed when no file yielded text", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createGoogleDriveSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Empty folder" },
      connector,
      documents: [{ title: "scan.pdf", text: null, status: "failed" }],
      skipped: 0,
    });
    expect(source.status).toBe("failed");
  });

  it("re-syncs by replacing documents with fresh files", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createGoogleDriveSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Sales playbooks" },
      connector,
      documents: [{ title: "v1.pdf", text: "first version", status: "extracted" }],
      skipped: 0,
    });
    await syncGoogleDriveSource(store, actor(aliceOrg.id, alice.id), source.id, {
      documents: [{ title: "v2.pdf", text: "second version", status: "extracted" }],
      skipped: 0,
    });
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1); // replaced, not duplicated
    expect(docs[0].textContent).toContain("second version");
    expect(store._auditEvents().some((e) => e.action === "knowledge_source.synced")).toBe(true);
  });

  it("refuses to sync a non-drive source", async () => {
    const { store, alice, aliceOrg } = await setup();
    const text = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Note",
      text: "hello",
    });
    await expect(
      syncGoogleDriveSource(store, actor(aliceOrg.id, alice.id), text.id, {
        documents: [],
        skipped: 0,
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });
});

describe("cloud storage source", () => {
  const connector = {
    provider: "gcs" as const,
    displayName: "my-bucket",
    prefix: "reports/",
    bucket: "my-bucket",
    region: null,
    connectionEncrypted: "ENC(service-account-json)",
  };

  it("stores one document per object and marks the source ready", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createCloudStorageSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Policy documents" },
      connector,
      documents: [
        { title: "refunds.pdf", text: "Refunds within 30 days.", status: "extracted" },
        { title: "notes.txt", text: "Internal note.", status: "extracted" },
      ],
      skipped: 2,
    });
    expect(source.sourceType).toBe("cloud_storage");
    expect(source.status).toBe("ready");
    expect(source.metadata.provider).toBe("gcs");
    expect(source.metadata.connectionEncrypted).toBe(connector.connectionEncrypted);
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(2);
    expect(docs.some((d) => d.textContent?.includes("30 days"))).toBe(true);
  });

  it("re-syncs by replacing documents with fresh objects", async () => {
    const { store, alice, aliceOrg } = await setup();
    const source = await createCloudStorageSource(store, actor(aliceOrg.id, alice.id), {
      meta: { name: "Policy documents" },
      connector,
      documents: [{ title: "v1.pdf", text: "first", status: "extracted" }],
      skipped: 0,
    });
    await syncCloudStorageSource(store, actor(aliceOrg.id, alice.id), source.id, {
      documents: [{ title: "v2.pdf", text: "second", status: "extracted" }],
      skipped: 0,
    });
    const docs = await store.listKnowledgeDocumentsForSource(aliceOrg.id, source.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].textContent).toContain("second");
    expect(store._auditEvents().some((e) => e.action === "knowledge_source.synced")).toBe(true);
  });

  it("refuses to sync a non-cloud-storage source", async () => {
    const { store, alice, aliceOrg } = await setup();
    const text = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Note",
      text: "hello",
    });
    await expect(
      syncCloudStorageSource(store, actor(aliceOrg.id, alice.id), text.id, {
        documents: [],
        skipped: 0,
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });
});

describe("assignment", () => {
  it("assigns and unassigns a source to an employee", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const source = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "FAQ",
      text: "Q&A",
    });

    await assignKnowledgeToEmployee(store, actor(aliceOrg.id, alice.id), {
      employeeId: employee.id,
      knowledgeSourceId: source.id,
    });
    expect(await store.countAssignedKnowledgeForEmployee(aliceOrg.id, employee.id)).toBe(1);

    // Assigning again is idempotent (unique constraint).
    await assignKnowledgeToEmployee(store, actor(aliceOrg.id, alice.id), {
      employeeId: employee.id,
      knowledgeSourceId: source.id,
    });
    expect(await store.countAssignedKnowledgeForEmployee(aliceOrg.id, employee.id)).toBe(1);

    const assigned = await store.listKnowledgeSourcesForEmployee(aliceOrg.id, employee.id);
    expect(assigned.map((s) => s.id)).toContain(source.id);

    const removed = await unassignKnowledgeFromEmployee(store, actor(aliceOrg.id, alice.id), {
      employeeId: employee.id,
      knowledgeSourceId: source.id,
    });
    expect(removed).toBe(true);
    expect(await store.countAssignedKnowledgeForEmployee(aliceOrg.id, employee.id)).toBe(0);

    const actions = store._auditEvents().map((e) => e.action);
    expect(actions).toContain("knowledge_source.assigned_to_employee");
    expect(actions).toContain("knowledge_source.unassigned_from_employee");
  });
});

describe("organization isolation", () => {
  it("never exposes a source to another organization", async () => {
    const { store, alice, aliceOrg, bobOrg } = await setup();
    const source = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Secret",
      text: "internal",
    });
    expect(await store.getKnowledgeSource(aliceOrg.id, source.id)).not.toBeNull();
    expect(await store.getKnowledgeSource(bobOrg.id, source.id)).toBeNull();
    expect(await store.listKnowledgeSources(bobOrg.id)).toHaveLength(0);
  });

  it("refuses to assign a source from another organization", async () => {
    const { store, alice, bob, aliceOrg, bobOrg } = await setup();
    const source = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Alpha",
      text: "x",
    });
    const bobEmployee = await store.createEmployee({
      organizationId: bobOrg.id,
      name: "Sam",
      roleTitle: "Ops AI",
    });
    await expect(
      assignKnowledgeToEmployee(store, actor(bobOrg.id, bob.id), {
        employeeId: bobEmployee.id,
        knowledgeSourceId: source.id,
      }),
    ).rejects.toBeInstanceOf(KnowledgeNotFoundError);
  });
});

describe("archive + overview", () => {
  it("archives a source and reflects it in the overview", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const s1 = await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "One",
      text: "a",
    });
    await createUrlSource(
      store,
      actor(aliceOrg.id, alice.id),
      { name: "Two", url: "https://x.com" },
      { text: null, status: "failed" },
    );
    await assignKnowledgeToEmployee(store, actor(aliceOrg.id, alice.id), {
      employeeId: employee.id,
      knowledgeSourceId: s1.id,
    });

    let overview = await getVaultOverview(store, aliceOrg.id);
    expect(overview.total).toBe(2);
    expect(overview.ready).toBe(1); // text source is ready; the unread url is not
    expect(overview.assigned).toBe(1);

    const archived = await archiveSource(store, actor(aliceOrg.id, alice.id), s1.id);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).not.toBeNull();
    expect(store._auditEvents().some((e) => e.action === "knowledge_source.archived")).toBe(true);

    overview = await getVaultOverview(store, aliceOrg.id);
    expect(overview.total).toBe(1); // archived excluded
  });
});

describe("audit safety", () => {
  it("does not record text content or file bytes in audit events", async () => {
    const { store, alice, aliceOrg } = await setup();
    await createTextSource(store, actor(aliceOrg.id, alice.id), {
      name: "Sensitive",
      text: "SECRET_TEXT_MARKER_9421",
    });
    const storage = new FakeStorage();
    await createFileSource(store, storage, actor(aliceOrg.id, alice.id), {
      meta: { name: "File" },
      file: {
        originalFilename: "secret.txt",
        contentType: "text/plain",
        bytes: bytes("FILE_SECRET_MARKER_7788"),
      },
      extraction: { text: "FILE_SECRET_MARKER_7788", status: "extracted" },
    });
    const auditJson = JSON.stringify(store._auditEvents());
    expect(auditJson).not.toContain("SECRET_TEXT_MARKER_9421");
    expect(auditJson).not.toContain("FILE_SECRET_MARKER_7788");
  });
});

describe("permissions (role matrix)", () => {
  it("grants knowledge.view to all roles and knowledge.manage only to owner/admin/builder", () => {
    for (const role of ["owner", "admin", "builder", "viewer"] as const) {
      expect(hasPermission(role, "knowledge.view")).toBe(true);
    }
    expect(hasPermission("owner", "knowledge.manage")).toBe(true);
    expect(hasPermission("admin", "knowledge.manage")).toBe(true);
    expect(hasPermission("builder", "knowledge.manage")).toBe(true);
    expect(hasPermission("viewer", "knowledge.manage")).toBe(false);
  });
});
