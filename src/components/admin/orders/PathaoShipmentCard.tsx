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
  AlertCircle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { CreatePathaoShipmentModal } from "./CreatePathaoShipmentModal";
import { PathaoTrackingModal } from "./PathaoTrackingModal";
import { refreshPathaoShipment, cancelPathaoShipment } from "../../../services/pathao.service";
import { notify } from "../../../lib/notify";

interface PathaoShipmentCardProps {
  order: any;
  onOrderUpdated: () => void;
  canManage: boolean;
}

export function PathaoShipmentCard({
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

  // Find Pathao shipment if exists (prefer the latest non-cancelled or latest)
  const pathaoShipments = (order.shipments || []).filter((s: any) => s.provider === "pathao");
  const activeShipment =
    pathaoShipments.find((s: any) => s.status !== "CANCELLED" && s.status !== "FAILED_DELIVERY") ||
    pathaoShipments[0] ||
    null;

  const consignmentId = activeShipment?.consignmentId || activeShipment?.trackingNumber || "N/A";
  const trackingUrl =
    activeShipment?.trackingUrl ||
    (consignmentId !== "N/A"
      ? `https://merchant.pathao.com/tracking?consignment_id=${consignmentId}`
      : null);

  // Action eligibility validations
  const isOrderTerminal =
    order.status?.toLowerCase() === "cancelled" || order.status?.toLowerCase() === "refunded";

  const isShipmentDelivered = activeShipment?.status === "DELIVERED";
  const isShipmentCancelled = activeShipment?.status === "CANCELLED";
  const canCancelShipment =
    activeShipment &&
    !isShipmentDelivered &&
    !isShipmentCancelled &&
    canManage;

  const handleCopyConsignment = () => {
    if (consignmentId && consignmentId !== "N/A") {
      navigator.clipboard.writeText(consignmentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify.success("Copied to clipboard", consignmentId);
    }
  };

  const handleRefresh = async () => {
    if (!activeShipment) return;
    setRefreshing(true);
    try {
      const updated = await refreshPathaoShipment(activeShipment.id);
      notify.success(
        "Shipment Status Refreshed",
        `Current Status: ${updated.providerStatus || updated.status}`
      );
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
      await cancelPathaoShipment(activeShipment.id, "Cancelled by admin from order details");
      notify.success("Shipment Cancelled", `Consignment ${consignmentId} has been cancelled.`);
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
          <Truck className="w-3.5 h-3.5" /> In Transit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <Clock className="w-3.5 h-3.5" /> Pending
      </span>
    );
  };

  return (
    <>
      <Card id="pathao-shipment-card" className="border shadow-xs">
        <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Pathao Shipment & Delivery
              </CardTitle>
            </div>
          </div>

          {activeShipment && (
            <div className="flex items-center gap-1.5">
              {getStatusBadge(activeShipment.status, activeShipment.providerStatus)}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {!activeShipment ? (
            /* No Shipment State */
            <div className="py-3 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-muted/60 text-muted-foreground">
                <Truck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Pathao Shipment Created</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  This order has not been dispatched to Pathao Courier yet. Generate a consignment to start tracking.
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
                  id="pathao-create-shipment-btn"
                  size="sm"
                  disabled={isOrderTerminal}
                  onClick={() => setCreateModalOpen(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs mt-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Create Pathao Shipment
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
                    <p className="font-semibold">Delivery Creation Failed</p>
                    <p className="text-[11px] mt-0.5">{activeShipment.providerError || "Courier service returned an error."}</p>
                  </div>
                </div>
              )}

              {/* Grid of Key Shipment Properties */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Consignment ID */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">Consignment ID</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-foreground text-xs">{consignmentId}</span>
                    <Button
                      id="copy-consignment-id-btn"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1"
                      onClick={handleCopyConsignment}
                      title="Copy Consignment ID"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Merchant Order ID */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">Merchant Order ID</span>
                  <p className="font-mono font-semibold text-foreground text-xs mt-0.5 truncate">
                    {activeShipment.merchantOrderId || "N/A"}
                  </p>
                </div>

                {/* COD Amount */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[11px] font-medium">COD Collect Amount</span>
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
                      : "Pending"}
                  </p>
                </div>
              </div>

              {/* Extended Info Rows */}
              <div className="space-y-2 pt-2 border-t text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Shipment Provider:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3 text-emerald-600" /> Pathao Courier
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Pathao Provider Status:</span>
                  <span className="font-medium text-foreground">
                    {activeShipment.providerStatus || activeShipment.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Dispatched At:</span>
                  <span>{new Date(activeShipment.createdAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Last Status Sync:</span>
                  <span>
                    {activeShipment.lastSyncAt
                      ? new Date(activeShipment.lastSyncAt).toLocaleString()
                      : new Date(activeShipment.updatedAt).toLocaleString()}
                  </span>
                </div>

                {trackingUrl && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Portal Link:</span>
                    <a
                      id="pathao-merchant-tracking-link"
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      Pathao Tracking Page <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  {/* View Tracking */}
                  <Button
                    id="pathao-view-tracking-btn"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrackingModalOpen(true)}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" /> View Tracking
                  </Button>

                  {/* Refresh Status */}
                  {canManage && (
                    <Button
                      id="pathao-refresh-status-btn"
                      variant="outline"
                      size="sm"
                      disabled={refreshing}
                      onClick={handleRefresh}
                      className="gap-1.5 text-xs h-8"
                      title="Sync latest status from Pathao"
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
                        id="pathao-cancel-shipment-btn"
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

      {/* Create Shipment Modal */}
      {createModalOpen && (
        <CreatePathaoShipmentModal
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
        title="Cancel Pathao Shipment?"
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to cancel Pathao consignment{" "}
              <strong className="font-mono text-foreground">{consignmentId}</strong> for Order #{order.orderNumber}?
            </p>
            <p className="text-xs text-muted-foreground">
              This will submit a cancellation request to Pathao and mark the shipment status as Cancelled. This operation is permanent.
            </p>
          </div>
        }
        confirmText="Yes, Cancel Consignment"
        cancelText="Keep Shipment"
        variant="destructive"
        isLoading={cancelling}
        onConfirm={handleCancel}
      />
    </>
  );
}
