import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge, Button, buttonClasses, EmptyState, Progress } from "@/components/ui";

describe("design system primitives", () => {
  it("renders a Button with its label and primary styling by default", () => {
    const { getByRole } = render(<Button>Hire</Button>);
    const btn = getByRole("button");
    expect(btn.textContent).toBe("Hire");
    expect(btn.className).toContain("bg-taurus-primary");
  });

  it("applies distinct variants via buttonClasses", () => {
    expect(buttonClasses("primary")).toContain("bg-taurus-primary");
    expect(buttonClasses("secondary")).toContain("border-taurus-line");
    expect(buttonClasses("ghost")).toContain("hover:bg-taurus-muted");
    // Sizes change padding.
    expect(buttonClasses("primary", "sm")).toContain("text-xs");
    expect(buttonClasses("primary", "lg")).toContain("py-2.5");
  });

  it("keeps buttons keyboard-focusable (native <button>)", () => {
    const { getByRole } = render(<Button>Ok</Button>);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.disabled).toBe(false);
  });

  it("renders a Badge with monochrome tone classes", () => {
    const { getByText } = render(<Badge tone="outline">Active</Badge>);
    expect(getByText("Active").className).toContain("border-taurus-line");
  });

  it("exposes an accessible progress bar", () => {
    const { getByRole } = render(<Progress value={42} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  it("renders an EmptyState with a title and action", () => {
    const { getByText } = render(
      <EmptyState
        title="You have not hired your first AI Employee yet."
        action={<button>Hire</button>}
      />,
    );
    expect(getByText("You have not hired your first AI Employee yet.")).toBeTruthy();
    expect(getByText("Hire")).toBeTruthy();
  });
});
