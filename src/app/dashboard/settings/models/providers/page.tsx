import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { isEncryptionConfigured } from "@/modules/model-gateway/credentials";
import { isPlatformKeyAvailable } from "@/modules/model-gateway/credential-resolver";
import {
  ProviderCredentialsPanel,
  type ProviderCredentialView,
} from "@/components/model-hub/provider-credentials";
import { AccessModeToggle } from "@/components/model-hub/access-mode-toggle";
import { buttonClasses, Notice, PageHeader } from "@/components/ui";

export default async function ModelProvidersPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.view")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(membership.role, "model_hub.manage");
  const encryptionConfigured = isEncryptionConfigured();

  const store = getStore();
  const providers = await store.listModelProviders();

  const items: ProviderCredentialView[] = await Promise.all(
    providers.map(async (p) => {
      const cred = await store.getProviderCredentialMetadata(organization.id, p.slug);
      return {
        slug: p.slug,
        displayName: p.displayName,
        supportsByok: p.supportsByok,
        supportsPlatformKey: p.supportsPlatformKey,
        platformAvailable: isPlatformKeyAvailable(p.slug),
        documentationUrl: p.documentationUrl,
        // A custom OpenAI-compatible provider has no default endpoint.
        requiresBaseUrl: p.defaultBaseUrl === null,
        credentialMode: cred?.credentialMode ?? null,
        status: cred?.status ?? null,
        keyLastFour: cred?.keyLastFour ?? null,
        baseUrl: cred?.baseUrl ?? null,
        label: cred?.label ?? null,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Model Hub"
        title="Providers"
        description="Enable providers with a Taurus-managed key, or securely bring your own."
        action={
          <Link href="/dashboard/settings/models" className={buttonClasses("secondary")}>
            Back to Model Hub
          </Link>
        }
      />

      {!encryptionConfigured ? (
        <div className="mb-5">
          <Notice>
            Secure key storage is not configured on this server, so bringing your own key is
            disabled. Providers with a Taurus-managed key still work.
          </Notice>
        </div>
      ) : null}

      <div className="mb-6">
        <AccessModeToggle current={organization.modelAccessMode} canManage={canManage} />
      </div>

      <ProviderCredentialsPanel
        items={items}
        encryptionConfigured={encryptionConfigured}
        canManage={canManage}
      />
    </div>
  );
}
