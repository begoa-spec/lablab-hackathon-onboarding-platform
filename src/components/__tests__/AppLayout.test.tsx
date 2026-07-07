import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const mockSignOut = vi.fn();

// Mock supabase
vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Outlet
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as Record<string, unknown>),
    Outlet: () => <div data-testid="outlet">Page content</div>,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated participant
  mockUseAuth.mockReturnValue({
    status: "authenticated",
    user: { id: "user-1", email: "test@example.com" },
    role: "participant",
  });
});

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter initialEntries={["/wizard"]}>{ui}</MemoryRouter>);
}

describe("AppLayout", () => {
  it("shows loading spinner when auth is loading", async () => {
    mockUseAuth.mockReturnValue({ status: "loading" });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    // Also check for the spinner element
    const spinners = screen.getAllByRole("status");
    expect(spinners.length).toBeGreaterThan(0);
  });

  it("renders sidebar with participant navigation", async () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "test@example.com" },
      role: "participant",
    });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    expect(screen.getAllByText("Onboarding")).toHaveLength(2); // desktop sidebar + mobile drawer
    expect(screen.getAllByText("LabLab")).toHaveLength(2);
    expect(screen.getAllByText("Sign Out")).toHaveLength(2);
  });

  it("renders sidebar with organizer navigation", async () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "org-1", email: "org@example.com" },
      role: "organizer",
    });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    expect(screen.getAllByText("Dashboard")).toHaveLength(2); // desktop sidebar + mobile drawer
    expect(screen.getAllByText("Hackathons")).toHaveLength(2);
  });

  it("calls signOut when clicking sign out button", async () => {
    const user = userEvent.setup();
    mockSignOut.mockResolvedValue({ error: null });

    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "test@example.com" },
      role: "participant",
    });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    // Scope to desktop sidebar to avoid duplicate buttons (mobile drawer + mobile header)
    const desktopSidebar = screen.getByLabelText("Sidebar navigation");
    const signOutBtn = within(desktopSidebar).getByRole("button", { name: /sign out/i });
    await user.click(signOutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders the outlet page content", async () => {
    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("toggles sidebar collapse", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "test@example.com" },
      role: "participant",
    });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    const collapseBtn = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    expect(collapseBtn).toBeInTheDocument();

    await user.click(collapseBtn);
    // After collapsing, the button label should change
    expect(
      screen.getByRole("button", { name: /expand sidebar/i })
    ).toBeInTheDocument();
  });

  it("opens mobile menu on hamburger click", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "test@example.com" },
      role: "participant",
    });

    const AppLayout = (await import("../AppLayout")).default;
    renderWithRouter(<AppLayout />);

    const menuBtn = screen.getByRole("button", {
      name: /open navigation menu/i,
    });
    await user.click(menuBtn);

    // The mobile drawer should now be visible
    expect(screen.getByRole("dialog", { name: /navigation menu/i })).toBeInTheDocument();
  });
});