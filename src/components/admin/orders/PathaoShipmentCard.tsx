import React, { useState } from "react";
import {
  Truck,
  RefreshCw,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  Clock,
  Banknote,
  PackageCheck,
  AlertCircle,
  FileText,
  Layers
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { CreateShipmentModal } from "./CreateShipmentModal";
import { PathaoTrackingModal } from "./PathaoTrackingModal";
import { refreshPathaoShipment, cancelPathaoShipment } from "../../../services/pathao.service";
import { updateShipmentStatus } from "../../../services/shipment.service";
import { notify } from "../../../lib/notify";

interface PathaoShipmentCardProps {
  order: any;
  onOrderUpdated: () => void;
  canManage: boolean;
}

export function OrderShipmentCard({
  order,
  onOrderUpdated,
  canManage = false,
}: PathaoShipmentCardProps) {
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  // Operation loading states
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Find any active shipment (prefer the latest non-cancelled or latest)
  const allShipments = (order.shipments || []).filter((s: any) => !s.deletedAt);
  const activeShipment =
    allShipments.find((s: any) => s.status !== "CANCELLED" && s.status !== "FAILED_DELIVERY") ||
    allShipments[0] ||
    null;

  const providerName =
    activeShipment?.provider === "manual"
      ? "Manual Courier"
      : activeShipment?.provider === "pathao"
      ? "Pathao Courier"
      : activeShipment?.provider
      ? `${activeShipment.provider.toUpperCase()} Courier`
      : "Manual Courier";

  const trackingRef =
    activeShipment?.trackingNumber || activeShipment?.consignmentId || "N/A";

  const trackingUrl =
    activeShipment?.trackingUrl ||
    (activeShipment?.provider === "pathao" && trackingRef !== "N/A"
      ? `https://merchant.pathao.com/tracking?consignment_id=${trackingRef}`
      : null);

  // Action eligibility validations
  const isOrderTerminal =
    order.status?.toLowerCase() === "cancelled" ||
    order.status?.toLowerCase() === "refunded" ||
    order.status?.toLowerCase() === "returned";

  const isShipmentDelivered = activeShipment?.status === "DELIVERED";
  const isShipmentCancelled = activeShipment?.status === "CANCELLED";
  const canCancelShipment =
    activeShipment &&
    !isShipmentDelivered &&
    !isShipmentCancelled &&
    canManage;

  const handleCopyTracking = () => {
    if (trackingRef && trackingRef !== "N/A") {
      navigator.clipboard.writeText(trackingRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify.success("Copied tracking reference", trackingRef);
    }
  };

  const handleRefresh = async () => {
    if (!activeShipment) return;
    setRefreshing(true);
    try {
      if (activeShipment.provider === "pathao") {
        const updated = await refreshPathaoShipment(activeShipment.id);
        notify.success(
          "Shipment Status Refreshed",
          `Current Status: ${updated.providerStatus || updated.status}`
        );
      } else {
        notify.info("Status Refreshed", `Shipment status: ${activeShipment.status}`);
      }
      onOrderUpdated();
    } catch (err: any) {
      notify.apiError(err, "Failed to refresh shipment status.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancel = async () => {
    if (!activeShipment) return;
    setCancelling(true);
    try {
      if (activeShipment.provider === "pathao") {
        await cancelPathaoShipment(activeShipment.id, "Cancelled by admin from order details");
      } else {
        await updateShipmentStatus(activeShipment.id, "CANCELLED");
      }
      notify.success("Shipment Cancelled", `Shipment reference ${trackingRef} marked as Cancelled.`);
      setConfirmCancelOpen(false);
      onOrderUpdated();
    } catch (err: any) {
      notify.apiError(err, "Failed to cancel shipment.");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string, providerStatus?: string) => {
    const st = (providerStatus || status || "").toLowerCase();
    if (st.includes("delivered")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <PackageCheck className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    if (st.includes("cancel")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <XCircle className="w-3.5 h-3.5" /> Cancelled
        </span>
      );
    }
    if (st.includes("return")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Returned
        </span>
      );
    }
    if (st.includes("transit") || st.includes("shipped") || st.includes("picked")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <Truck className="w-3.5 h-3.5" /> {status === "SHIPPED" ? "Shipped" : "In Transit"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <Clock className="w-3.5 h-3.5" /> {status || "Processing"}
      </span>
    );
  };

  const shipmentNotes =
    activeShipment?.providerMetadata?.notes || activeShipment?.notes;

  return (
    <>
      <Card id="order-shipment-card" className="border shadow-xs">
        <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Shipment & Fulfillment
              </CardTitle>
            </div>
          </div>

          {activeShipment && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {activeShipment.provider || "Manual"}
              </Badge>
              {getStatusBadge(activeShipment.status, activeShipment.providerStatus)}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {!activeShipment ? (
            /* No Active Shipment State */
            <div className="py-3 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-muted/60 text-muted-foreground">
                <Truck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Active Shipment</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  This order has not been dispatched yet. Choose a courier provider (Manual Courier or Pathao) to create a shipment.
                </p>
              </div>

              {isOrderTerminal && (
                <p className="text-xs text-rose-600 font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Shipment cannot be created for {order.status} orders.
                </p>
              )}

              {canManage && (
                <Button
                  id="btn-open-create-shipment"
                  size="sm"
                  disabled={isOrderTerminal}
                  onClick={() => setCreateModalOpen(true)}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs mt-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Create Shipment
                </Button>
              )}
            </div>
          ) : (
            /* Active Shipment Details State */
            <div className="space-y-4">
              {/* Status Alert if Cancelled or Failed */}
              {activeShipment.status === "FAILED_DELIVERY" && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Delivery Failed</p>
                    <p className="text-[11px] mt-0.5">
                      {activeShipment.providerError || "Courier service reported delivery failure."}
                    </p>
                  </div>
                </div>
              )}

              {/* Grid of Key Shipment Properties */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Tracking Reference */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">Tracking Reference</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-foreground text-xs">{trackingRef}</span>
                    <Button
                      id="copy-tracking-btn"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1"
                      onClick={handleCopyTracking}
                      title="Copy Tracking Reference"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Courier Provider */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">Courier Provider</span>
                  <p className="font-semibold text-foreground text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
                    {providerName}
                  </p>
                </div>

                {/* COD Amount */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">COD Amount</span>
                  <p className="font-bold text-emerald-600 text-xs mt-0.5">
                    ৳{Number(activeShipment.codAmount || 0).toFixed(2)}
                  </p>
                </div>

                {/* Delivery Fee */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">Delivery Fee</span>
                  <p className="font-semibold text-foreground text-xs mt-0.5">
                    {activeShipment.deliveryFee !== null && activeShipment.deliveryFee !== undefined
                      ? `৳${Number(activeShipment.deliveryFee).toFixed(2)}`
                      : "0.00"}
                  </p>
                </div>
              </div>

              {/* Extended Info Rows */}
              <div className="space-y-2 pt-2 border-t text-xs">
                {shipmentNotes && (
                  <div className="flex items-start justify-between text-muted-foreground">
                    <span className="shrink-0 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-muted-foreground" /> Dispatch Notes:
                    </span>
                    <span className="font-medium text-foreground text-right pl-4">
                      {shipmentNotes}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Dispatched At:</span>
                  <span>{new Date(activeShipment.createdAt).toLocaleString()}</span>
                </div>

                {trackingUrl && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Tracking Link:</span>
                    <a
                      id="merchant-tracking-link"
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      Courier Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  {/* View Tracking */}
                  <Button
                    id="btn-view-tracking"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrackingModalOpen(true)}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" /> View Timeline
                  </Button>

                  {/* Refresh Status */}
                  {canManage && activeShipment.provider === "pathao" && (
                    <Button
                      id="btn-refresh-shipment-status"
                      variant="outline"
                      size="sm"
                      disabled={refreshing}
                      onClick={handleRefresh}
                      className="gap-1.5 text-xs h-8"
                      title="Sync latest status from Courier"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? "Syncing..." : "Refresh"}
                    </Button>
                  )}
                </div>

                {/* Cancel Shipment */}
                {canManage && (
                  <div>
                    {canCancelShipment ? (
                      <Button
                        id="btn-cancel-shipment"
                        variant="ghost"
                        size="sm"
                        disabled={cancelling}
                        onClick={() => setConfirmCancelOpen(true)}
                        className="gap-1 text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel Shipment
                      </Button>
                    ) : isShipmentDelivered ? (
                      <span className="text-[11px] text-muted-foreground italic">Delivered (Final)</span>
                    ) : isShipmentCancelled ? (
                      <span className="text-[11px] text-muted-foreground italic">Shipment Cancelled</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider-Agnostic Create Shipment Modal */}
      {createModalOpen && (
        <CreateShipmentModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          order={order}
          onSuccess={() => {
            onOrderUpdated();
          }}
        />
      )}

      {/* Tracking Modal */}
      {trackingModalOpen && activeShipment && (
        <PathaoTrackingModal
          isOpen={trackingModalOpen}
          onClose={() => setTrackingModalOpen(false)}
          shipment={activeShipment}
          onShipmentUpdated={() => {
            onOrderUpdated();
          }}
          canManage={canManage}
        />
      )}

      {/* Confirm Cancellation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Cancel Shipment?"
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to cancel shipment{" "}
              <strong className="font-mono text-foreground">{trackingRef}</strong> for Order #{order.orderNumber}?
            </p>
            <p className="text-xs text-muted-foreground">
              This will update the shipment status to Cancelled.
            </p>
          </div>
        }
        confirmText="Yes, Cancel Shipment"
        cancelText="Keep Shipment"
        variant="destructive"
        isLoading={cancelling}
        onConfirm={handleCancel}
      />
    </>
  );
}

// Backward compatibility alias for any existing imports
export const PathaoShipmentCard = OrderShipmentCard;
