// Application constants – not secrets
export const APP_NAME = "LabLab Onboarding";
export const APP_TAGLINE = "Get ready to build";

// Discord invite URL for the hackathon server (public-facing, not a secret)
export const DISCORD_INVITE_URL =
  import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/lablab";

// Discord server ID where team channels will be created
export const DISCORD_SERVER_ID =
  import.meta.env.VITE_DISCORD_SERVER_ID || "";