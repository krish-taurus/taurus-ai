import Link from "next/link";
import { buttonClasses, EmptyState } from "@/components/ui";

/** Shown when a knowledge source is not found in the current organization. */
export default function KnowledgeSourceNotFound() {
  return (
    <div className="max-w-3xl">
      <EmptyState
        title="Knowledge source not found"
        description="This knowledge source does not exist in your organization, or it may have been removed."
        action={
          <Link href="/dashboard/knowledge" className={buttonClasses("primary")}>
            Back to Knowledge Vault
          </Link>
        }
      />
    </div>
  );
}
