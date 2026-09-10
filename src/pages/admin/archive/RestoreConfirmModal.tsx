import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RotateCcw, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ArchiveListItem, SupportedArchiveEntityType } from "../../../services/archive.service";

interface RestoreConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: SupportedArchiveEntityType;
  item: ArchiveListItem | null;
  isLoading: boolean;
  onConfirm: () => Promise<void> | void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  isOpen,
  onOpenChange,
  entityType,
  item,
  isLoading,
  onConfirm,
}) => {
  if (!item) return null;

  const primaryIdentifier = item.sku || item.slug || item.raw?.orderNumber || item.raw?.code || item.id;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !isLoading && onOpenChange(open)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-card text-card-foreground p-6 shadow-2xl rounded-xl border border-border sm:rounded-2xl transition-all animate-in fade-in-0 zoom-in-95"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-full shrink-0 bg-primary/15 text-primary">
              <RotateCcw className="h-5 w-5" />
            </div>

            <div className="space-y-2 flex-1 pr-2">
              <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
                Restore Archived Record
              </DialogPrimitive.Title>
              
              <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
                You are about to restore the following archived record back to active status:
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border/80 space-y-2 text-sm">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="uppercase tracking-wider font-semibold">Entity Type:</span>
              <span className="font-mono bg-background px-2 py-0.5 rounded border capitalize">{entityType}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase">Record:</span>
              <span className="font-semibold text-foreground text-right">{item.displayName}</span>
            </div>
            {primaryIdentifier && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase">Identifier:</span>
                <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{primaryIdentifier}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="font-semibold uppercase">Archived Date:</span>
              <span>{new Date(item.deletedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Context-specific notes */}
          {entityType === "products" && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <strong>Catalog Review Notice:</strong> Restored products return in <strong>Draft</strong> (inactive) status so catalog managers can verify inventory and pricing before publishing live. Co-archived variants are also reactivated.
              </div>
            </div>
          )}

          {entityType === "orders" && (
            <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <strong>Order Restoration Notice:</strong> Restoring this order will reactivate its record, co-restore associated archived payments, and log an audit timeline entry.
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isLoading}
              onClick={onConfirm}
              className="w-full sm:w-auto gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isLoading ? "Restoring Record..." : "Confirm Restore"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
