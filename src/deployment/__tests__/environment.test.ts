import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("deployment environment configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when Supabase deployment variables are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(import("../../lib/supabase")).rejects.toThrow(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.",
    );
  });

  it("creates the Supabase client when deployment variables are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-anon-key");

    const { supabase } = await import("../../lib/supabase");

    expect(supabase).toBeDefined();
  });

  it("exposes the deployment-facing app configuration values", async () => {
    const { APP_NAME, APP_TAGLINE, DISCORD_INVITE_URL } =
      await import("../../lib/config");

    expect(APP_NAME).toBeTruthy();
    expect(APP_TAGLINE).toBeTruthy();
    expect(DISCORD_INVITE_URL).toBeTruthy();
  });
});
