import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Tables, TablesInsert } from "../lib/database.types";
import Papa from "papaparse";
import {
  Loader2,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Trophy,
  Calendar,
  Users,
  FileText,
} from "lucide-react";
import { SiDiscord, SiGithub } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

interface ParsedRow {
  team_name: string;
  participant_name: string;
  participant_email: string;
  github_username?: string;
  discord_username?: string;
  _errors?: string[];
  _rowNum: number;
}

type ImportStep = "upload" | "preview" | "confirming" | "result";

interface ImportResult {
  success: boolean;
  teams_created: number;
  participants_created: number;
  teams_skipped: number;
  participants_skipped: number;
  errors: { row: number; field: string; message: string }[];
  summary: string;
}

interface TeamCounts {
  teams: number;
  participants: number;
}

/* ── Helpers ────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Create / Edit Hackathon Modal ─────────────────── */

function HackathonFormModal({
  hackathon,
  onClose,
  onSaved,
}: {
  hackathon?: Tables<"hackathons"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!hackathon;
  const [name, setName] = useState(hackathon?.name ?? "");
  const [slug, setSlug] = useState(hackathon?.slug ?? "");
  const [discordServerId, setDiscordServerId] = useState(
    hackathon?.discord_server_id ?? ""
  );
  const [githubOrg, setGithubOrg] = useState(hackathon?.github_org ?? "");
  const [startDate, setStartDate] = useState(
    hackathon?.start_date ? hackathon.start_date.slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState(
    hackathon?.end_date ? hackathon.end_date.slice(0, 10) : ""
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    hackathon?.welcome_message ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  const handleNameChange = useCallback(
    (val: string) => {
      setName(val);
      if (!isEdit) setSlug(slugify(val));
    },
    [isEdit]
  );

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Hackathon name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    setSaving(true);

    const hackData: TablesInsert<"hackathons"> = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      discord_server_id: discordServerId.trim() || null,
      github_org: githubOrg.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      welcome_message: welcomeMessage.trim() || null,
    };

    try {
      if (isEdit && hackathon) {
        const { error: updateError } = await supabase
          .from("hackathons")
          .update(hackData)
          .eq("id", hackathon.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        // Create hackathon
        const { data: newHack, error: createError } = await supabase
          .from("hackathons")
          .insert(hackData)
          .select("id")
          .single();

        if (createError) throw new Error(createError.message);

        // Link to organizer
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: organizer } = await supabase
            .from("organizers")
            .select("id")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (organizer) {
            await supabase.from("organizer_hackathons").insert({
              organizer_id: organizer.id,
              hackathon_id: newHack.id,
            });
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit hackathon" : "Create hackathon"}
    >
      <div
        className="w-full max-w-lg bg-background border border-border rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg text-foreground tracking-wider uppercase mb-6">
          {isEdit ? "Edit Hackathon" : "Create Hackathon"}
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium">
              Hackathon Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. AMD AI Hackathon 2025"
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium">
              Slug <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="amd-ai-hackathon-2025"
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Discord & GitHub row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
                <SiDiscord className="w-3 h-3" aria-hidden="true" />
                Discord Server ID
              </label>
              <input
                type="text"
                value={discordServerId}
                onChange={(e) => setDiscordServerId(e.target.value)}
                placeholder="e.g. 128338718..."
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
                <SiGithub className="w-3 h-3" aria-hidden="true" />
                GitHub Org
              </label>
              <input
                type="text"
                value={githubOrg}
                onChange={(e) => setGithubOrg(e.target.value)}
                placeholder="e.g. amd-ai"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="block text-xs text-foreground/60 uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" aria-hidden="true" />
              Welcome Message
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Optional welcome message for participants..."
              rows={3}
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/70 hover:bg-muted transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="w-4 h-4" aria-hidden="true" />
            )}
            {isEdit ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirmation Dialog ────────────────────── */

function DeleteConfirmDialog({
  hackathon,
  onClose,
  onDeleted,
}: {
  hackathon: Tables<"hackathons">;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      // Delete participants
      await supabase.from("participants").delete().eq("hackathon_id", hackathon.id);

      // Delete teams
      await supabase.from("teams").delete().eq("hackathon_id", hackathon.id);

      // Delete organizer_hackathons links
      await supabase
        .from("organizer_hackathons")
        .delete()
        .eq("hackathon_id", hackathon.id);

      // Delete audit logs
      await supabase.from("audit_logs").delete().eq("hackathon_id", hackathon.id);

      // Delete the hackathon
      const { error: deleteError } = await supabase
        .from("hackathons")
        .delete()
        .eq("id", hackathon.id);

      if (deleteError) throw new Error(deleteError.message);

      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Delete hackathon"
    >
      <div
        className="w-full max-w-sm bg-background border border-border rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <Trash2 className="w-6 h-6 text-destructive" aria-hidden="true" />
        </div>

        <h2 className="font-heading text-lg text-foreground tracking-wider uppercase text-center mb-2">
          Delete Hackathon?
        </h2>
        <p className="text-sm text-foreground/60 text-center mb-6">
          This will permanently delete <strong className="text-foreground">{hackathon.name}</strong>{" "}
          and all associated teams, participants, and data. This cannot be undone.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/70 hover:bg-muted transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Import Modal ──────────────────────────────────── */

function ImportModal({
  hackathon,
  onClose,
  onImported,
}: {
  hackathon: Tables<"hackathons">;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  /* ── File parsing ───────────────────────────────── */

  const parseRows = useCallback(
    (raws: Record<string, unknown>[]): ParsedRow[] => {
      return raws.map((raw, i) => {
        const row: ParsedRow = {
          team_name: String(raw.team_name ?? raw.team ?? "").trim(),
          participant_name: String(
            raw.participant_name ?? raw.name ?? raw.participant ?? ""
          ).trim(),
          participant_email: String(
            raw.participant_email ?? raw.email ?? ""
          ).trim(),
          github_username:
            String(raw.github_username ?? raw.github ?? "").trim() ||
            undefined,
          discord_username:
            String(raw.discord_username ?? raw.discord ?? "").trim() ||
            undefined,
          _rowNum: i + 1,
        };

        const errs: string[] = [];
        if (!row.team_name) errs.push("Missing team name");
        if (!row.participant_name) errs.push("Missing participant name");
        if (!row.participant_email) errs.push("Missing email");
        else if (!isValidEmail(row.participant_email))
          errs.push("Invalid email format");
        if (errs.length > 0) row._errors = errs;

        return row;
      });
    },
    []
  );

  const parseCsvFile = useCallback(
    (text: string) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) =>
          h.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (results) => {
          if (results.errors.length > 0) {
            setParseError(
              `CSV parsing error on row ${results.errors[0].row + 1}: ${results.errors[0].message}`
            );
            return;
          }
          const parsed = parseRows(results.data as Record<string, unknown>[]);
          setRows(parsed);
          setStep("preview");
        },
      });
    },
    [parseRows]
  );

  const parseJsonFile = useCallback(
    (text: string) => {
      try {
        const data = JSON.parse(text);

        let flat: Record<string, unknown>[];
        if (Array.isArray(data)) {
          flat = data;
        } else if (data.teams || data.rows || data.data) {
          flat = (data.teams ?? data.rows ?? data.data) as Record<
            string,
            unknown
          >[];
        } else {
          setParseError(
            "JSON format not recognized. Expected an array of objects."
          );
          return;
        }

        if (!Array.isArray(flat)) {
          setParseError("JSON data should be an array.");
          return;
        }

        const parsed = parseRows(flat);
        setRows(parsed);
        setStep("preview");
      } catch {
        setParseError("Invalid JSON file.");
      }
    },
    [parseRows]
  );

  const parseFile = useCallback((file: File) => {
    setParseError(null);
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (ext === "csv") {
        parseCsvFile(text);
      } else if (ext === "json") {
        parseJsonFile(text);
      } else {
        setParseError("Please upload a CSV or JSON file.");
      }
    };
    reader.readAsText(file);
  }, [parseCsvFile, parseJsonFile]);

  /* ── Drag-and-drop handlers ──────────────────────── */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  /* ── Confirm import ──────────────────────────────── */

  const confirmImport = useCallback(async () => {
    setStep("confirming");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setResult({
        success: false,
        teams_created: 0,
        participants_created: 0,
        teams_skipped: 0,
        participants_skipped: 0,
        errors: [{ row: 0, field: "auth", message: "Not authenticated" }],
        summary: "Authentication error.",
      });
      setStep("result");
      return;
    }

    const { data, error } = await supabase.functions.invoke("import-teams", {
      body: {
        hackathon_id: hackathon.id,
        data: rows.map((r) => ({
          team_name: r.team_name,
          participant_name: r.participant_name,
          participant_email: r.participant_email,
          github_username: r.github_username,
          discord_username: r.discord_username,
        })),
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      setResult({
        success: false,
        teams_created: 0,
        participants_created: 0,
        teams_skipped: 0,
        participants_skipped: 0,
        errors: [{ row: 0, field: "function", message: error.message }],
        summary: "Failed to invoke import function.",
      });
    } else {
      setResult(data as ImportResult);
    }

    setStep("result");
  }, [hackathon.id, rows]);

  /* ── Render ──────────────────────────────────────── */

  const hasErrors = rows.some((r) => r._errors && r._errors.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={step === "confirming" ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import teams"
    >
      <div
        className="w-full max-w-3xl bg-background border border-border rounded-2xl p-6 shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg text-foreground tracking-wider uppercase mb-1">
          Import Teams
        </h2>
        <p className="text-xs text-foreground/40 font-mono mb-5">
          {hackathon.name}
        </p>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div>
            <div
              ref={dropRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/40 hover:bg-muted/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload CSV or JSON file"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <p className="text-foreground/80 font-medium mb-1">
                {isDragging
                  ? "Drop your file here"
                  : "Drop CSV/JSON file or click to browse"}
              </p>
              <p className="text-xs text-foreground/40">
                Supports .csv and .json files
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileSelect}
              aria-label="File picker for CSV or JSON"
            />

            {parseError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {parseError}
              </div>
            )}

            {/* Template download */}
            <div className="mt-4 flex items-center gap-2 text-xs text-foreground/40">
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Expected columns: team_name, participant_name, participant_email</span>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-foreground/70">
                <span className="font-medium text-foreground">{rows.length}</span> row
                {rows.length !== 1 ? "s" : ""} found in{" "}
                <span className="font-mono text-xs text-foreground/50">{fileName}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setParseError(null);
                }}
                className="text-xs text-accent hover:text-accent/80 cursor-pointer"
              >
                Choose different file
              </button>
            </div>

            {hasErrors && (
              <div className="mb-4 flex items-center gap-2 text-sm text-amber bg-amber/10 border border-amber/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {rows.filter((r) => r._errors).length} row
                  {rows.filter((r) => r._errors).length !== 1 ? "s" : ""} have
                  validation errors. Error rows will be skipped.
                </span>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-auto max-h-64 border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs text-foreground/50 uppercase tracking-wider">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Team</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">GitHub</th>
                    <th className="px-3 py-2 font-medium">Discord</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row._errors && row._errors.length > 0
                          ? "bg-destructive/5"
                          : "hover:bg-muted/50"
                      }
                    >
                      <td className="px-3 py-2 text-xs text-foreground/40 font-mono">
                        {row._rowNum}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.team_name || <span className="italic text-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.participant_name || <span className="italic text-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.participant_email || <span className="italic text-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2 text-foreground/60 font-mono text-xs">
                        {row.github_username || <span className="italic text-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2 text-foreground/60 font-mono text-xs">
                        {row.discord_username || <span className="italic text-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row._errors && row._errors.length > 0 ? (
                          <span
                            className="text-xs text-destructive"
                            title={row._errors.join("; ")}
                          >
                            Error
                          </span>
                        ) : (
                          <Check className="w-4 h-4 text-accent" aria-hidden="true" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setParseError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/70 hover:bg-muted transition-all duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={rows.filter((r) => !r._errors || r._errors.length === 0).length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Import{" "}
                {rows.filter((r) => !r._errors || r._errors.length === 0).length}{" "}
                valid row
                {rows.filter((r) => !r._errors || r._errors.length === 0).length !== 1
                  ? "s"
                  : ""}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirming */}
        {step === "confirming" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" aria-hidden="true" />
            <p className="text-foreground/80 font-medium">Importing teams...</p>
            <p className="text-xs text-foreground/40 mt-1">
              Creating teams and participants
            </p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && result && (
          <div>
            <div
              className={`rounded-2xl border p-6 text-center mb-5 ${
                result.success
                  ? "bg-accent/5 border-accent/20"
                  : result.participants_created > 0
                    ? "bg-amber/5 border-amber/20"
                    : "bg-destructive/5 border-destructive/20"
              }`}
            >
              {result.success ? (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-accent" aria-hidden="true" />
                </div>
              ) : (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" aria-hidden="true" />
                </div>
              )}
              <p className="text-lg text-foreground font-heading uppercase tracking-wider">
                {result.summary}
              </p>
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="text-center">
                  <p className="text-2xl font-heading text-accent">
                    {result.teams_created}
                  </p>
                  <p className="text-xs text-foreground/40">teams created</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-heading text-accent">
                    {result.participants_created}
                  </p>
                  <p className="text-xs text-foreground/40">participants</p>
                </div>
                {result.errors.length > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-heading text-destructive">
                      {result.errors.length}
                    </p>
                    <p className="text-xs text-foreground/40">errors</p>
                  </div>
                )}
              </div>
            </div>

            {/* Errors list */}
            {result.errors.length > 0 && (
              <div className="mb-5 max-h-32 overflow-y-auto space-y-1">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2"
                  >
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Row {err.row}: <strong>{err.field}</strong> — {err.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onImported();
                onClose();
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Hackathons Page ──────────────────────────── */

export default function HackathonsPlaceholder() {
  const queryClient = useQueryClient();
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHackathon, setEditingHackathon] = useState<
    Tables<"hackathons"> | null
  >(null);
  const [deletingHackathon, setDeletingHackathon] = useState<
    Tables<"hackathons"> | null
  >(null);
  const [importingHackathon, setImportingHackathon] = useState<
    Tables<"hackathons"> | null
  >(null);

  // Get organizer ID
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("organizers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (data) setOrganizerId(data.id);
    });
  }, []);

  // Fetch organizer's hackathons
  const {
    data: hackathons,
    isLoading: hackathonsLoading,
  } = useQuery({
    queryKey: ["organizer-hackathons", organizerId],
    queryFn: async () => {
      if (!organizerId) return [];
      const { data: links } = await supabase
        .from("organizer_hackathons")
        .select("hackathon_id")
        .eq("organizer_id", organizerId);

      if (!links || links.length === 0) return [];

      const hackIds = links.map((l) => l.hackathon_id);
      const { data: hack } = await supabase
        .from("hackathons")
        .select("*")
        .in("id", hackIds)
        .order("created_at", { ascending: false });

      return (hack ?? []) as Tables<"hackathons">[];
    },
    enabled: !!organizerId,
  });

  // Fetch team/participant counts for all hackathons
  const { data: counts } = useQuery({
    queryKey: ["hackathon-counts", hackathons?.map((h) => h.id)],
    queryFn: async () => {
      if (!hackathons || hackathons.length === 0) return new Map<string, TeamCounts>();

      const hackIds = hackathons.map((h) => h.id);
      const countsMap = new Map<string, TeamCounts>();

      // Get team counts
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, hackathon_id")
        .in("hackathon_id", hackIds);

      const teamCounts = new Map<string, number>();
      for (const t of teamData ?? []) {
        teamCounts.set(t.hackathon_id, (teamCounts.get(t.hackathon_id) ?? 0) + 1);
      }

      // Get participant counts
      const { data: participantData } = await supabase
        .from("participants")
        .select("id, hackathon_id")
        .in("hackathon_id", hackIds);

      const participantCounts = new Map<string, number>();
      for (const p of participantData ?? []) {
        participantCounts.set(
          p.hackathon_id,
          (participantCounts.get(p.hackathon_id) ?? 0) + 1
        );
      }

      for (const id of hackIds) {
        countsMap.set(id, {
          teams: teamCounts.get(id) ?? 0,
          participants: participantCounts.get(id) ?? 0,
        });
      }

      return countsMap;
    },
    enabled: !!hackathons && hackathons.length > 0,
  });

  const hackathonCounts = counts ?? new Map<string, TeamCounts>();

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["organizer-hackathons"] });
    queryClient.invalidateQueries({ queryKey: ["hackathon-counts"] });
  }, [queryClient]);

  /* ── Hackathon status ────────────────────────────── */

  const getHackathonStatus = useCallback(
    (h: Tables<"hackathons">): "upcoming" | "active" | "ended" => {
      const now = new Date();
      if (h.start_date && new Date(h.start_date) > now) return "upcoming";
      if (h.end_date && new Date(h.end_date) < now) return "ended";
      return "active";
    },
    []
  );

  /* ── Loading state ───────────────────────────────── */

  if (hackathonsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading hackathons">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
            Hackathons
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            Manage your hackathons and import teams
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Hackathon
        </button>
      </div>

      {/* Empty state */}
      {!hackathons || hackathons.length === 0 ? (
        <div className="bg-muted border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-accent" aria-hidden="true" />
          </div>
          <p className="text-foreground/80 font-medium">No hackathons yet</p>
          <p className="text-foreground/40 text-sm mt-1 max-w-md mx-auto">
            Create your first hackathon to start managing teams and onboarding
            participants.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create Your First Hackathon
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hackathons.map((hackathon) => {
            const c = hackathonCounts.get(hackathon.id);
            const status = getHackathonStatus(hackathon);

            const statusStyles: Record<string, string> = {
              active: "bg-accent/10 border-accent/30 text-accent",
              upcoming: "bg-secondary/10 border-secondary/30 text-secondary",
              ended: "bg-foreground/5 border-foreground/20 text-foreground/50",
            };

            const statusLabels: Record<string, string> = {
              active: "Active",
              upcoming: "Upcoming",
              ended: "Ended",
            };

            return (
              <div
                key={hackathon.id}
                className="bg-muted border border-border rounded-2xl overflow-hidden hover:border-foreground/10 transition-all duration-200"
              >
                {/* Card body */}
                <div className="p-5">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-heading text-base text-foreground tracking-wider truncate">
                      {hackathon.name}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyles[status]}`}
                    >
                      {statusLabels[status]}
                    </span>
                  </div>

                  {/* Slug */}
                  <p className="text-xs text-foreground/40 font-mono mb-3">
                    /{hackathon.slug}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{c?.teams ?? 0} teams</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{c?.participants ?? 0} participants</span>
                    </div>
                    {hackathon.start_date && (
                      <div className="flex items-center gap-1.5 text-xs text-foreground/40">
                        <Calendar className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {formatDate(hackathon.start_date)}
                          {hackathon.end_date
                            ? ` – ${formatDate(hackathon.end_date)}`
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* GitHub + Discord */}
                  <div className="flex items-center gap-3 text-xs text-foreground/40 mb-4">
                    {hackathon.github_org && (
                      <span className="flex items-center gap-1">
                        <SiGithub className="w-3 h-3" aria-hidden="true" />
                        {hackathon.github_org}
                      </span>
                    )}
                    {hackathon.discord_server_id && (
                      <span className="flex items-center gap-1">
                        <SiDiscord className="w-3 h-3" aria-hidden="true" />
                        ID: {hackathon.discord_server_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImportingHackathon(hackathon)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 active:scale-[0.97] transition-all duration-150 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingHackathon(hackathon)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground/60 text-xs font-medium hover:bg-foreground/5 active:scale-[0.97] transition-all duration-150 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingHackathon(hackathon)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 active:scale-[0.97] transition-all duration-150 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <HackathonFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={refetch}
        />
      )}

      {editingHackathon && (
        <HackathonFormModal
          hackathon={editingHackathon}
          onClose={() => setEditingHackathon(null)}
          onSaved={refetch}
        />
      )}

      {deletingHackathon && (
        <DeleteConfirmDialog
          hackathon={deletingHackathon}
          onClose={() => setDeletingHackathon(null)}
          onDeleted={refetch}
        />
      )}

      {importingHackathon && (
        <ImportModal
          hackathon={importingHackathon}
          onClose={() => setImportingHackathon(null)}
          onImported={refetch}
        />
      )}
    </div>
  );
}