"use client";

import { Alert, Button } from "@/components/ui";

/** Error boundary for the AI Employees area (Prompt 003; restyled 005B). */
export default function EmployeesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Alert title="Something went wrong loading your AI Employees.">
      <p>Please try again.</p>
      <div className="mt-4 flex justify-center">
        <Button variant="secondary" onClick={reset}>
          Retry
        </Button>
      </div>
    </Alert>
  );
}
