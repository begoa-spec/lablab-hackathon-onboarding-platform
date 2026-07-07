import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APP_NAME, APP_TAGLINE } from "../../lib/config";

// Mock supabase
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  },
}));

vi.mock("../../lib/config", () => ({
  APP_NAME: "LabLab Onboarding",
  APP_TAGLINE: "Get ready to build",
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("Auth", () => {
  it("renders the app name and tagline", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText(APP_TAGLINE)).toBeInTheDocument();
  });

  it("shows email and password inputs", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("shows Sign In and Sign Up tabs with Sign In active by default", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const signInTab = screen.getByRole("button", { name: "Sign In" });
    const signUpTab = screen.getByRole("button", { name: "Sign Up" });

    expect(signInTab).toHaveAttribute("aria-pressed", "true");
    expect(signUpTab).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to Sign Up tab", async () => {
    const user = userEvent.setup();
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const signUpTab = screen.getByRole("button", { name: "Sign Up" });
    await user.click(signUpTab);

    expect(signUpTab).toHaveAttribute("aria-pressed", "true");
  });

  it("shows Participant role by default", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(screen.getByText("Participant")).toBeInTheDocument();
    expect(screen.queryByText("Organizer")).not.toBeInTheDocument();
  });

  it("toggles to Organizer role", async () => {
    const user = userEvent.setup();
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const toggleBtn = screen.getByText("I am an organizer");
    await user.click(toggleBtn);

    expect(screen.getByText("Organizer")).toBeInTheDocument();
    expect(screen.queryByText("Participant")).not.toBeInTheDocument();
  });

  it("calls signInWithPassword on Sign In submit", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "mypassword");

    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(signInBtn);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "mypassword",
    });
  });

  it("shows error on invalid password credentials", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrongpass");

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText(/wrong email or password/i)
    ).toBeInTheDocument();
  });

  it("shows generic error message from supabase", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Email not confirmed" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "pass");

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Email not confirmed")).toBeInTheDocument();
  });

  it("calls signUp on Sign Up submit", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({ data: { user: null }, error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to sign up
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await user.type(screen.getByPlaceholderText("you@example.com"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "password");

    const createBtn = screen.getByRole("button", { name: /create account/i });
    await user.click(createBtn);

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password",
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it("shows confirmation message after sign up when email confirmation needed", async () => {
    const user = userEvent.setup();
    // User exists but no session = confirmation required
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.type(screen.getByPlaceholderText("you@example.com"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "password");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      screen.getByText(/check your email for a confirmation link/i)
    ).toBeInTheDocument();
  });

  it("signs up and immediately creates organizer record for organizer role", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({
      data: { user: { id: "u1", email: "org@test.com" }, session: { access_token: "tok" } },
      error: null,
    });
    mockUpsert.mockResolvedValue({ data: null, error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to organizer
    await user.click(screen.getByText("I am an organizer"));
    // Switch to sign up
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    await user.type(screen.getByPlaceholderText("you@example.com"), "org@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "password");

    await user.click(screen.getByRole("button", { name: /create organizer account/i }));

    expect(mockUpsert).toHaveBeenCalledWith(
      { auth_user_id: "u1", email: "org@test.com" },
      { onConflict: "auth_user_id" }
    );
  });

  it("disables submit button when email or password is empty", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    expect(submitBtn).toBeDisabled();
  });

  it("calls signInWithOAuth for GitHub", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const githubBtn = screen.getByRole("button", { name: /github/i });
    await user.click(githubBtn);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
  });

  it("shows error message when GitHub OAuth fails", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "OAuth provider error" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const githubBtn = screen.getByRole("button", { name: /github/i });
    await user.click(githubBtn);

    expect(
      screen.getByText("OAuth provider error")
    ).toBeInTheDocument();
  });

  it("stores pending_role in sessionStorage when signing in as organizer via GitHub", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to organizer
    await user.click(screen.getByText("I am an organizer"));

    const githubBtn = screen.getByRole("button", { name: /github/i });
    await user.click(githubBtn);

    expect(sessionStorage.getItem("pending_role")).toBe("organizer");
  });

  it("calls upsert organizer after successful password sign-in as organizer", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "org@test.com" } },
      error: null,
    });
    mockUpsert.mockResolvedValue({ data: null, error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to organizer
    await user.click(screen.getByText("I am an organizer"));

    await user.type(screen.getByPlaceholderText("you@example.com"), "org@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "password");

    await user.click(screen.getByRole("button", { name: /sign in as organizer/i }));

    expect(mockSignInWithPassword).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("shows Participant-specific footer text", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(
      screen.getByText(/by signing in, you agree to participate/i)
    ).toBeInTheDocument();
  });

  it("shows Organizer-specific footer text after toggle", async () => {
    const user = userEvent.setup();
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    await user.click(screen.getByText("I am an organizer"));

    expect(
      screen.getByText(/organizers can create and manage hackathons/i)
    ).toBeInTheDocument();
  });
});