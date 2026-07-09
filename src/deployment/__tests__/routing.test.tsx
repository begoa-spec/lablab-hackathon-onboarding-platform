import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockUseAuth = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../components/Auth", () => ({
  default: () => <div data-testid="auth-page">Auth Page</div>,
}));

vi.mock("../../components/AppLayout", () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("../../pages/DashboardPlaceholder", () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

vi.mock("../../pages/WizardPlaceholder", () => ({
  default: () => <div data-testid="wizard-page">Wizard</div>,
}));

vi.mock("../../pages/HackathonsPlaceholder", () => ({
  default: () => <div data-testid="hackathons-page">Hackathons</div>,
}));

vi.mock("../../pages/RegistrationPage", () => ({
  default: () => <div data-testid="registration-page">Registration</div>,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

let App: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  App = (await import("../../App")).default;
});

describe("deployment routing safeguards", () => {
  it("shows the auth screen for unauthenticated users", () => {
    mockUseAuth.mockReturnValue({ status: "unauthenticated" });

    renderApp(["/"]);

    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });

  it("redirects authenticated organizers to the dashboard from the landing route", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "org-1" },
      role: "organizer",
    });

    renderApp(["/"]);

    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("redirects authenticated participants to the wizard from the landing route", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1" },
      role: "participant",
    });

    renderApp(["/"]);

    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("routes unknown-role users to registration", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-2" },
      role: "unknown",
    });

    renderApp(["/"]);

    expect(screen.getByTestId("registration-page")).toBeInTheDocument();
  });
});
