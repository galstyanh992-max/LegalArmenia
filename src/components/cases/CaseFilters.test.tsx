import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CaseFilters } from "./CaseFilters";
import type { CaseFilters as CaseFiltersType } from "@/hooks/useCases";

// Mock useTranslation: return the key so aria-label attributes are deterministic
// and non-empty (mirrors how the real t() exposes the control name).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en" },
  }),
}));

describe("CaseFilters", () => {
  it("renders three filter comboboxes", () => {
    const { container } = render(
      <CaseFilters filters={{}} onFiltersChange={() => {}} />,
    );
    const combos = container.querySelectorAll('button[role="combobox"]');
    expect(combos.length).toBe(3);
  });

  it("gives every filter combobox a non-empty accessible name via aria-label", () => {
    const { container } = render(
      <CaseFilters filters={{}} onFiltersChange={() => {}} />,
    );
    const combos = Array.from(
      container.querySelectorAll('button[role="combobox"]'),
    ) as HTMLElement[];
    expect(combos.length).toBeGreaterThan(0);
    for (const combo of combos) {
      const label = combo.getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect((label ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the translated status/priority/sort names as accessible names", () => {
    const filters: CaseFiltersType = {};
    const { container } = render(
      <CaseFilters filters={filters} onFiltersChange={() => {}} />,
    );
    const labels = Array.from(
      container.querySelectorAll('button[role="combobox"]'),
    ).map((b) => (b as HTMLElement).getAttribute("aria-label"));
    expect(labels).toContain("Filter by status");
    expect(labels).toContain("Filter by priority");
    expect(labels).toContain("Sort by");
  });
});
