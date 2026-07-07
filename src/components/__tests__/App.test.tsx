import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock all the page components
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

// Mock AppLayout — must include Outlet so nested routes render
vi.mock("../AppLayout", () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="app-layout"><Outlet />{children}</div>
  ),
}));

// Mock Auth
vi.mock("../Auth", () => ({
  default: () => <div data-testid="auth-page">Auth Page</div>,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderApp() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

let App: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  App = (await import("../../App")).default;
});

describe("App - Routing", () => {
  it("renders auth page when unauthenticated at /", () => {
    mockUseAuth.mockReturnValue({ status: "unauthenticated" });

    renderApp();

    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });

  it("renders loading spinner when auth loading at /", () => {
    mockUseAuth.mockReturnValue({ status: "loading" });

    renderApp();

    const spinners = screen.getAllByRole("status");
    expect(spinners.length).toBeGreaterThan(0);
  });

  it("redirects participant to /wizard at /", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1" },
      role: "participant",
    });

    renderApp();

    expect(screen.getByTestId("wizard-page")).toBeInTheDocument();
  });

  it("redirects organizer to /dashboard at /", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "org-1" },
      role: "organizer",
    });

    renderApp();

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders auth page when role is unknown", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1" },
      role: "unknown",
    });

    renderApp();

    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });
});