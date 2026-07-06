import Link from "next/link";
import { buttonClasses, EmptyState } from "@/components/ui";

/** Shown when the employee for this DNA page is not in the current organization. */
export default function EmployeeDnaNotFound() {
  return (
    <div className="max-w-3xl">
      <EmptyState
        title="AI Employee not found"
        description="This AI Employee does not exist in your organization, or it may have been removed."
        action={
          <Link href="/dashboard/employees" className={buttonClasses("primary")}>
            Back to AI Employees
          </Link>
        }
      />
    </div>
  );
}
