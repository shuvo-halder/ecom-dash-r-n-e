import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { 
  Trash2, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  Lock,
  FileWarning
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { 
  ArchiveListItem, 
  SupportedArchiveEntityType, 
  HardDeleteCheckResult, 
  archiveService 
} from "../../../services/archive.service";
import { notify } from "../../../lib/notify";
import { useAuth } from "../../../context/AuthContext";

interface HardDeleteSafetyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: SupportedArchiveEntityType;
  item: ArchiveListItem | null;
  onSuccess: () => void;
}

export const HardDeleteSafetyModal: React.FC<HardDeleteSafetyModalProps> = ({
  isOpen,
  onOpenChange,
  entityType,
  item,
  onSuccess,
}) => {
  const { isSuperAdmin } = useAuth();
  const [safetyResult, setSafetyResult] = useState<HardDeleteCheckResult | null>(null);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);
  const [typedIdentifier, setTypedIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Compute the exact required identifier to match
  const requiredIdentifier = 
    item?.sku || 
    item?.slug || 
    item?.raw?.orderNumber || 
    item?.raw?.code || 
    item?.displayName || 
    item?.id || 
    "";

  // When modal opens, run the safety check
  useEffect(() => {
    if (isOpen && item) {
      setSafetyResult(null);
      setTypedIdentifier("");
      setReason("");
      setActionError(null);
      runSafetyCheck();
    }
  }, [isOpen, item?.id]);

  const runSafetyCheck = async (): Promise<HardDeleteCheckResult | null> => {
    if (!item) return null;
    setIsCheckingSafety(true);
    setActionError(null);
    try {
      const res = await archiveService.checkHardDeleteSafety(entityType, item.id);
      setSafetyResult(res);
      return res;
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err.message || "Failed to perform safety check.";
      setActionError(errMsg);
      setSafetyResult({
        allowed: false,
        reason: errMsg,
        dependencies: [],
      });
      return null;
    } finally {
      setIsCheckingSafety(false);
    }
  };

  if (!item) return null;

  const isIdentifierMatched = 
    typedIdentifier.trim() === requiredIdentifier.trim() && 
    requiredIdentifier.trim().length > 0;

  const isReasonValid = reason.trim().length >= 3;
  const isAllowed = safetyResult?.allowed === true;
  const canSubmit = isSuperAdmin && isAllowed && isIdentifierMatched && isReasonValid && !isSubmitting && !isCheckingSafety;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !item) return;

    setIsSubmitting(true);
    setActionError(null);

    try {
      // Race condition protection: Re-check safety immediately before submission
      const freshSafety = await runSafetyCheck();
      if (!freshSafety || !freshSafety.allowed) {
        setActionError(
          freshSafety?.reason || "Pre-flight safety check failed. The record cannot be hard deleted."
        );
        setIsSubmitting(false);
        return;
      }

      // Execute hard delete
      const res = await archiveService.hardDeleteEntity(entityType, item.id, reason.trim());
      notify.success("Permanent Purge Complete", res.message || `"${item.displayName}" was permanently deleted from the database.`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to permanently delete record.";
      setActionError(msg);
      notify.apiError(err, "Hard delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-xl translate-x-[-50%] translate-y-[-50%] bg-card text-card-foreground p-6 shadow-2xl rounded-xl border border-destructive/30 sm:rounded-2xl transition-all animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full shrink-0 bg-destructive/15 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5 flex-1 pr-2">
              <div className="flex items-center gap-2">
                <DialogPrimitive.Title className="text-lg font-bold tracking-tight text-foreground">
                  Controlled Hard Delete
                </DialogPrimitive.Title>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                  Irreversible
                </span>
              </div>
              <DialogPrimitive.Description className="text-xs text-muted-foreground leading-relaxed">
                Permanently purge this record and all associated database entries. This operation bypasses normal recovery and cannot be undone.
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* SuperAdmin privilege gate */}
          {!isSuperAdmin && (
            <div className="mt-4 p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3 text-xs text-destructive">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Authorization Restricted:</strong> Permanent hard delete is locked to <strong>Super Admin</strong> roles only. Staff and standard admin roles cannot execute database purges.
              </div>
            </div>
          )}

          {/* Target Record Info Box */}
          <div className="mt-4 p-3.5 rounded-lg bg-muted/40 border border-border/70 space-y-2 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="font-semibold uppercase">Target Entity:</span>
              <span className="font-mono bg-background px-2 py-0.5 rounded border capitalize">{entityType}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="font-semibold uppercase text-muted-foreground">Record Name:</span>
              <span className="font-semibold text-foreground text-right">{item.displayName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold uppercase text-muted-foreground">Verification Identifier:</span>
              <span className="font-mono font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                {requiredIdentifier}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="font-semibold uppercase">Archived Since:</span>
              <span>{new Date(item.deletedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Backend Safety Check Status Banner */}
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Backend Safety Pre-Flight:</span>
              {isCheckingSafety && (
                <span className="flex items-center gap-1 text-[11px] text-primary normal-case">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verifying dependencies...
                </span>
              )}
            </div>

            {isCheckingSafety && !safetyResult && (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-primary" />
                Contacting safety engine and evaluating foreign-key relationships...
              </div>
            )}

            {!isCheckingSafety && safetyResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                  safetyResult.allowed
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                <div className="flex items-start gap-2.5 font-medium">
                  {safetyResult.allowed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {safetyResult.allowed ? "Safety Check Passed: Purge Permitted" : "Safety Check Failed: Purge Prohibited"}
                    </div>
                    <div className="mt-1 text-xs opacity-90">{safetyResult.reason}</div>
                  </div>
                </div>

                {safetyResult.dependencies && safetyResult.dependencies.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-current/20">
                    <span className="font-bold text-[11px] uppercase tracking-wider block mb-1">
                      Evaluated References & Dependencies:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                      {safetyResult.dependencies.map((dep, idx) => (
                        <li key={idx}>{dep}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {actionError && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/15 border border-destructive/40 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{actionError}</div>
            </div>
          )}

          {/* Form with Required Inputs */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Administrative Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                required
                disabled={!isAllowed || !isSuperAdmin || isSubmitting}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for audit trail (min 3 characters, e.g. 'Customer GDPR right-to-be-forgotten request verified')"
                className="w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30 disabled:opacity-50"
              />
              <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between">
                <span>Minimum 3 characters required.</span>
                <span>{reason.trim().length} characters</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Type <code className="font-mono text-destructive font-bold select-all bg-destructive/10 px-1 py-0.5 rounded">{requiredIdentifier}</code> to confirm:
              </label>
              <input
                type="text"
                required
                disabled={!isAllowed || !isSuperAdmin || isSubmitting}
                value={typedIdentifier}
                onChange={(e) => setTypedIdentifier(e.target.value)}
                placeholder={`Type "${requiredIdentifier}" exactly`}
                className="w-full px-3 py-2 text-xs font-mono rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={!canSubmit}
                className="w-full sm:w-auto gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Purging Permanently...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hard Delete Record
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
