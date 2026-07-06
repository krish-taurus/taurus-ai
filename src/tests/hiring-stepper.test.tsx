import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HiringStepper, type HiringStep } from "@/components/hiring/hiring-stepper";

const STEPS: HiringStep[] = [
  { key: "role", label: "Choose role" },
  { key: "describe", label: "Describe" },
  { key: "style", label: "Working style" },
  { key: "review", label: "Review & hire" },
];

describe("HiringStepper", () => {
  it("renders every step label", () => {
    const { container } = render(<HiringStepper steps={STEPS} currentStep={1} />);
    for (const step of STEPS) {
      expect(container.textContent).toContain(step.label);
    }
  });

  it("marks the current step with aria-current", () => {
    const { container } = render(<HiringStepper steps={STEPS} currentStep={2} />);
    const current = container.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    // The active marker is the 2nd step's number bubble.
    expect(current?.textContent).toBe("2");
  });

  it("shows completed steps with a check mark", () => {
    const { container } = render(<HiringStepper steps={STEPS} currentStep={3} />);
    // Steps 1 and 2 are complete → two check marks.
    const checks = [...container.querySelectorAll("span")].filter((s) => s.textContent === "✓");
    expect(checks.length).toBe(2);
  });
});
