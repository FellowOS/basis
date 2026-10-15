import { useCallback, useEffect, useRef, useState } from "react";
import {
  explorerApiErrorMessage,
  explorerGetJson,
  explorerMutationResult,
  explorerPartialSuccessWarning,
  parseExplorerJson,
} from "../../lib/explorer-api-error";
import { explorerFetch } from "../../host/explorerHttp";
import { ontologyPath, useOntologyKbId } from "./ontologyKb";
import { readOntologyUrlState, writeProposalSelection } from "./ontologyUrlState";
import {
  Layers,
  GitMerge,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  ArrowRight,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";

interface VersionEntry {
  version_id: string;
  ontology_uri: string;
  state: "draft" | "published";
  author: string;
  date: string;
  diff_summary: Record<string, any>;
}

function shaclSummaryLine(shacl: Record<string, unknown>): string {
  if (!shacl || Object.keys(shacl).length === 0) return "No SHACL report attached.";
  const conforms = shacl.conforms ?? shacl.valid;
  const rawViolations = shacl.violations ?? shacl.results ?? shacl.report;
  const violationCount = Array.isArray(rawViolations) ? rawViolations.length : 0;
  if (typeof conforms === "boolean") {
    return conforms
      ? "SHACL: conforms"
      : `SHACL: does not conform (${violationCount} violation${violationCount === 1 ? "" : "s"})`;
  }
  if (violationCount > 0) return `SHACL: ${violationCount} violation(s) listed`;
  return "SHACL: see detailed report";
}

function impactSummaryLine(impact: Record<string, unknown>): string {
  if (!impact || Object.keys(impact).length === 0) return "No impact analysis.";
  const parts: string[] = [];
  for (const key of ["classes_added", "classes_removed", "properties_added", "properties_removed", "individuals_added", "individuals_removed"]) {
    const val = impact[key];
    if (typeof val === "number" && val > 0) parts.push(`${key.replace(/_/g, " ")}: ${val}`);
  }
  if (parts.length) return parts.join(" · ");
  const summary = impact.summary ?? impact.message;
  if (typeof summary === "string" && summary.trim()) return summary.trim();
  return "See detailed impact JSON below.";
}

interface Proposal {
  proposal_id: string;
  draft_id: string;
  ontology_uri: string;
  summary: string;
  author: string;
  reviewer: string | null;
  state: "draft" | "proposed" | "approved" | "published" | "rejected";
  impact_analysis: Record<string, any>;
  shacl_validation: Record<string, any>;
  created_at: string;
  updated_at: string;
  comments: Record<string, any>[];
}

export function VersionsTab() {
  const kbId = useOntologyKbId();
  const [ontologyUri, setOntologyUri] = useState<string>("");
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparePair, setComparePair] = useState<{ v1: string; v2: string } | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const [uriDialogOpen, setUriDialogOpen] = useState(false);
  const [uriDraft, setUriDraft] = useState("");
  const openedProposalFromUrl = useRef<string | null>(null);

  useEffect(() => {
    const { proposalId } = readOntologyUrlState();
    if (!proposalId || proposals.length === 0) return;
    if (openedProposalFromUrl.current === proposalId) return;
    const match = proposals.find((p) => p.proposal_id === proposalId);
    if (!match) return;
    openedProposalFromUrl.current = proposalId;
    if (match.ontology_uri) setOntologyUri(match.ontology_uri);
    setSelectedProposal(match);
    setShowProposalModal(true);
  }, [proposals]);

  useEffect(() => {
    if (!selectedProposal) return;
    const fresh = proposals.find((p) => p.proposal_id === selectedProposal.proposal_id);
    if (fresh && fresh.state !== selectedProposal.state) {
      setSelectedProposal(fresh);
    }
  }, [proposals, selectedProposal?.proposal_id, selectedProposal?.state]);

  const loadVersions = useCallback(async () => {
    if (!ontologyUri) return;
    setError("");
    try {
      const { data, partialWarning } = await explorerGetJson<VersionEntry[]>(
        ontologyPath(kbId, `versions/${encodeURIComponent(ontologyUri)}`),
        undefined,
        {
          fallbackMessage: "Failed to load versions",
          partialWarning: "Warning: Partial success loading versions.",
        },
      );
      setVersions(data);
      if (partialWarning) setError(partialWarning);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    }
  }, [kbId, ontologyUri]);

  const loadProposals = useCallback(async () => {
    setError("");
    try {
      const { data, partialWarning } = await explorerGetJson<Proposal[]>(
        ontologyPath(kbId, "proposals"),
        undefined,
        {
          fallbackMessage: "Failed to load proposals",
          partialWarning: "Warning: Partial success loading proposals.",
        },
      );
      setProposals(data);
      if (partialWarning) setError(partialWarning);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    }
  }, [kbId]);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      if (!ignore) setError("");
      try {
        const { data: propData, partialWarning: propWarn } = await explorerGetJson<Proposal[]>(
          ontologyPath(kbId, "proposals"),
          undefined,
          {
            fallbackMessage: "Failed to load proposals",
            partialWarning: "Warning: Partial success loading proposals.",
          },
        );
        if (!ignore) {
          setProposals(propData);
          if (propWarn) setError(propWarn);
        }
      } catch (err) {
        if (!ignore) setError(explorerApiErrorMessage(err));
      }

      if (!ontologyUri) return;
      try {
        const { data: verData, partialWarning: verWarn } = await explorerGetJson<VersionEntry[]>(
          ontologyPath(kbId, `versions/${encodeURIComponent(ontologyUri)}`),
          undefined,
          {
            fallbackMessage: "Failed to load versions",
            partialWarning: "Warning: Partial success loading versions.",
          },
        );
        if (!ignore) {
          setVersions(verData);
          if (verWarn) setError((prev) => prev || verWarn);
        }
      } catch (err) {
        if (!ignore) setError((prev) => prev || explorerApiErrorMessage(err));
      }
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, [kbId, ontologyUri]);

  const approveProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await explorerFetch(ontologyPath(kbId, `proposals/${proposalId}/approve`), {
        method: "POST",
      });
      const partial = await explorerMutationResult(
        response,
        "Failed to approve proposal",
        "Warning: Partial success approving proposal.",
      );
      if (partial) setError(partial);
      else setModalNotice("Proposal approved");
      loadProposals();
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    }
  }, [kbId, loadProposals]);

  const rejectProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await explorerFetch(ontologyPath(kbId, `proposals/${proposalId}/reject`), {
        method: "POST",
      });
      const partial = await explorerMutationResult(
        response,
        "Failed to reject proposal",
        "Warning: Partial success rejecting proposal.",
      );
      if (partial) setError(partial);
      else setModalNotice("Proposal rejected");
      loadProposals();
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    }
  }, [kbId, loadProposals]);

  const publishProposal = useCallback(async (proposalId: string) => {
    setError("");
    try {
      const response = await explorerFetch(ontologyPath(kbId, `proposals/${proposalId}/publish`), {
        method: "POST",
      });
      const partial = await explorerMutationResult(
        response,
        "Failed to publish proposal",
        "Warning: Partial success publishing proposal.",
      );
      if (partial) setError(partial);
      else setModalNotice("Proposal published");
      loadProposals();
      loadVersions();
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    }
  }, [kbId, loadProposals, loadVersions]);

  const runVersionComparison = useCallback(async () => {
    if (!comparePair || !ontologyUri) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await explorerFetch(ontologyPath(kbId, `versions/${encodeURIComponent(ontologyUri)}/compare`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version1: comparePair.v1,
          version2: comparePair.v2,
        }),
      });
      const data = await parseExplorerJson<Record<string, unknown>>(
        response,
        "Failed to compare versions",
      );
      const partial = explorerPartialSuccessWarning(
        response,
        data,
        "Warning: Partial success comparing versions.",
      );
      if (partial) setError(partial);
      setCompareResult(data);
    } catch (err) {
      setError(explorerApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [kbId, comparePair, ontologyUri]);

  const getStateIcon = (state: string) => {
    switch (state) {
      case "published":
        return <CheckCircle size={16} className="text-ok" />;
      case "approved":
        return <CheckCircle size={16} className="text-primary" />;
      case "rejected":
        return <XCircle size={16} className="text-destructive" />;
      case "proposed":
        return <AlertCircle size={16} className="text-warn" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="m-0 text-xl font-bold text-foreground">Versions & Change Proposals</h1>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setUriDraft(ontologyUri);
            setUriDialogOpen(true);
          }}
        >
          {ontologyUri
            ? `URI: ${ontologyUri.length > 40 ? `${ontologyUri.slice(0, 40)}…` : ontologyUri}`
            : "Set ontology URI"}
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers size={16} />
          Version History
        </h2>
        <div className="flex flex-col gap-2">
          {versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No versions found</div>
          ) : (
            versions.map((version) => (
              <div
                key={version.version_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors"
              >
                {getStateIcon(version.state)}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{version.version_id}</div>
                  <div className="text-xs text-muted-foreground">
                    {version.author} • {new Date(version.date).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setComparePair({ v1: version.version_id, v2: versions[0]?.version_id || "" });
                    setShowCompareModal(true);
                  }}
                >
                  <ArrowRight size={12} />
                  Compare
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <GitMerge size={16} />
          Change Proposals
        </h2>
        <div className="flex flex-col gap-2">
          {proposals.length === 0 ? (
            <div className="text-sm text-muted-foreground">No proposals found</div>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.proposal_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors"
              >
                {getStateIcon(proposal.state)}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{proposal.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {proposal.author} • {new Date(proposal.created_at).toLocaleDateString()}
                  </div>
                </div>
                {proposal.state === "proposed" && (
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" onClick={() => approveProposal(proposal.proposal_id)}>
                      <CheckCircle size={12} />
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => rejectProposal(proposal.proposal_id)}>
                      <XCircle size={12} />
                      Reject
                    </Button>
                  </div>
                )}
                {proposal.state === "approved" && (
                  <Button type="button" size="sm" onClick={() => publishProposal(proposal.proposal_id)}>
                    <Send size={12} />
                    Publish
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    writeProposalSelection(proposal.proposal_id);
                    setSelectedProposal(proposal);
                    setModalNotice("");
                    setShowProposalModal(true);
                  }}
                >
                  <FileText size={12} />
                  Details
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={showProposalModal && Boolean(selectedProposal)} onOpenChange={setShowProposalModal}>
        <DialogContent className="max-h-[min(92vh,40rem)] max-w-2xl overflow-y-auto">
          {selectedProposal ? (
            <>
            <DialogHeader>
              <DialogTitle>Proposal details</DialogTitle>
              <DialogDescription>{selectedProposal.summary}</DialogDescription>
            </DialogHeader>
            <div className="mb-3">
              <Label className="text-muted-foreground">Summary</Label>
              <div className="mt-1 text-sm text-foreground">{selectedProposal.summary}</div>
            </div>
            <div className="mb-3">
              <Label className="text-muted-foreground">State</Label>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                {getStateIcon(selectedProposal.state)}
                {selectedProposal.state}
              </div>
            </div>
            <div className="mb-3">
              <Label className="text-muted-foreground">Proposal ID</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">
                  {selectedProposal.proposal_id}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(selectedProposal.proposal_id);
                    setModalNotice("Proposal ID copied.");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            {selectedProposal.shacl_validation?.conforms === false ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {shaclSummaryLine(selectedProposal.shacl_validation)} — publish may be blocked until resolved.
              </div>
            ) : null}
            {modalNotice ? (
              <div className="mb-3 text-xs text-ok">{modalNotice}</div>
            ) : null}
            <div className="mb-3">
              <Label className="text-muted-foreground">Impact Analysis</Label>
              <div className="mb-1.5 text-xs text-muted-foreground">
                {impactSummaryLine(selectedProposal.impact_analysis)}
              </div>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground">
                {JSON.stringify(selectedProposal.impact_analysis, null, 2)}
              </pre>
            </div>
            <div className="mb-3">
              <Label className="text-muted-foreground">SHACL Validation</Label>
              <div className="mb-1.5 text-xs text-muted-foreground">
                {shaclSummaryLine(selectedProposal.shacl_validation)}
              </div>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground">
                {JSON.stringify(selectedProposal.shacl_validation, null, 2)}
              </pre>
            </div>
            <div>
              <Label className="text-muted-foreground">Comments ({selectedProposal.comments.length})</Label>
              <div className="mt-1 max-h-[120px] space-y-1.5 overflow-auto">
                {selectedProposal.comments.map((comment, idx) => (
                  <div key={String(comment.id ?? idx)} className="rounded-md border bg-muted/40 p-2">
                    <div className="text-xs font-semibold text-foreground">{comment.author}</div>
                    <div className="text-xs text-muted-foreground">{comment.text}</div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="mt-4 flex-wrap gap-2">
              {selectedProposal.state === "proposed" && (
                <>
                  <Button type="button" size="sm" onClick={() => approveProposal(selectedProposal.proposal_id)}>
                    <CheckCircle size={12} />
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => rejectProposal(selectedProposal.proposal_id)}>
                    <XCircle size={12} />
                    Reject
                  </Button>
                </>
              )}
              {selectedProposal.state === "approved" && (
                <Button type="button" size="sm" onClick={() => publishProposal(selectedProposal.proposal_id)}>
                  <Send size={12} />
                  Publish
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setShowProposalModal(false)}>
                Close
              </Button>
            </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showCompareModal && Boolean(comparePair)} onOpenChange={setShowCompareModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compare versions</DialogTitle>
            <DialogDescription>Diff two version IDs for the scoped ontology.</DialogDescription>
          </DialogHeader>
          {comparePair ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="compare-v1">Version 1</Label>
                  <Input
                    id="compare-v1"
                    value={comparePair.v1}
                    onChange={(e) => setComparePair({ ...comparePair, v1: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compare-v2">Version 2</Label>
                  <Input
                    id="compare-v2"
                    value={comparePair.v2}
                    onChange={(e) => setComparePair({ ...comparePair, v2: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCompareModal(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={isLoading} onClick={runVersionComparison}>
                  <Scale size={12} />
                  {isLoading ? "Comparing…" : "Compare"}
                </Button>
              </DialogFooter>
              {compareResult ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
                  {JSON.stringify(compareResult, null, 2)}
                </pre>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={uriDialogOpen} onOpenChange={setUriDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ontology scope</DialogTitle>
            <DialogDescription>Version history loads for this ontology URI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ontology-uri-scope">Ontology URI</Label>
            <Input
              id="ontology-uri-scope"
              value={uriDraft}
              onChange={(e) => setUriDraft(e.target.value)}
              placeholder="https://example.org/onto#"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUriDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOntologyUri(uriDraft.trim());
                setUriDialogOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
