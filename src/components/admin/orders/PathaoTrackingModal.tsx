import React, { useState } from "react";
import {
  Truck,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  MapPin,
  Banknote,
  Package,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { refreshPathaoShipment } from "../../../services/pathao.service";
import { notify } from "../../../lib/notify";

interface PathaoTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: any;
  onShipmentUpdated?: (updated: any) => void;
  canManage?: boolean;
}

export function PathaoTrackingModal({
  isOpen,
  onClose,
  shipment,
  onShipmentUpdated,
  canManage = false,
}: PathaoTrackingModalProps) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentShipment, setCurrentShipment] = useState(shipment);

  // Sync state if prop changes
  React.useEffect(() => {
    setCurrentShipment(shipment);
  }, [shipment]);

  if (!isOpen || !currentShipment) return null;

  const consignmentId = currentShipment.consignmentId || currentShipment.trackingNumber || "N/A";
  const trackingUrl =
    currentShipment.trackingUrl ||
    (consignmentId !== "N/A"
      ? `https://merchant.pathao.com/tracking?consignment_id=${consignmentId}`
      : null);

  const handleCopy = () => {
    if (consignmentId && consignmentId !== "N/A") {
      navigator.clipboard.writeText(consignmentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify.success("Copied to clipboard", consignmentId);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const updated = await refreshPathaoShipment(currentShipment.id);
      setCurrentShipment(updated);
      if (onShipmentUpdated) {
        onShipmentUpdated(updated);
      }
      notify.success("Shipment Status Refreshed", `Latest status: ${updated.providerStatus || updated.status}`);
    } catch (err: any) {
      notify.apiError(err, "Failed to refresh Pathao status.");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string, providerStatus?: string) => {
    const st = (providerStatus || status || "").toLowerCase();
    if (st.includes("delivered")) {
      return <Badge variant="success" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Delivered</Badge>;
    }
    if (st.includes("cancel")) {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (st.includes("return")) {
      return <Badge variant="destructive" className="bg-amber-100 text-amber-800">Returned</Badge>;
    }
    if (st.includes("transit") || st.includes("shipped") || st.includes("picked")) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">In Transit</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>;
  };

  return (
    <div
      id="pathao-tracking-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <Card className="w-full max-w-xl shadow-2xl border-border bg-background my-8">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Pathao Consignment Tracking</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consignment ID: <span className="font-mono font-semibold text-foreground">{consignmentId}</span>
              </p>
            </div>
          </div>
          <Button
            id="pathao-tracking-close-btn"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-xl border border-border/70 text-center">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Status</p>
              <div className="mt-1 flex justify-center">
                {getStatusBadge(currentShipment.status, currentShipment.providerStatus)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Provider</p>
              <p className="text-xs font-bold text-foreground mt-1.5 flex items-center justify-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                Pathao
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">COD Amount</p>
              <p className="text-xs font-bold text-emerald-600 mt-1.5">
                ৳{Number(currentShipment.codAmount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Delivery Fee</p>
              <p className="text-xs font-bold text-foreground mt-1.5">
                {currentShipment.deliveryFee !== null && currentShipment.deliveryFee !== undefined
                  ? `৳${Number(currentShipment.deliveryFee).toFixed(2)}`
                  : "Pending"}
              </p>
            </div>
          </div>

          {/* Consignment Identification Details */}
          <div className="space-y-3 p-4 rounded-lg bg-card border border-border/80 text-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Consignment ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">{consignmentId}</span>
                <Button
                  id="pathao-copy-consignment-btn"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                  title="Copy Consignment ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Merchant Order ID:</span>
              <span className="font-mono font-medium text-foreground">
                {currentShipment.merchantOrderId || "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Pathao Status Text:</span>
              <span className="font-semibold text-foreground">
                {currentShipment.providerStatus || currentShipment.status}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-muted-foreground">Created At:</span>
              <span>{new Date(currentShipment.createdAt).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Updated / Synced:</span>
              <span>
                {currentShipment.lastSyncAt
                  ? new Date(currentShipment.lastSyncAt).toLocaleString()
                  : new Date(currentShipment.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Tracking Events Timeline */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Tracking History
            </h4>

            {currentShipment.trackingEvents && currentShipment.trackingEvents.length > 0 ? (
              <div className="relative border-l-2 border-muted ml-3 pl-5 space-y-4">
                {currentShipment.trackingEvents.map((evt: any, idx: number) => (
                  <div key={evt.id || idx} className="relative text-xs">
                    <span className="absolute -left-[27px] top-1 bg-background border-2 border-primary rounded-full w-2.5 h-2.5" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{evt.status}</span>
                      {evt.location && (
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> {evt.location}
                        </span>
                      )}
                    </div>
                    {evt.description && <p className="text-muted-foreground mt-0.5">{evt.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(evt.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                <p>No detailed checkpoint events recorded yet.</p>
                <p className="text-[11px] mt-1">
                  Pathao updates live tracking as riders accept, pick up, and route packages.
                </p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
            {trackingUrl ? (
              <a
                id="pathao-open-tracking-link"
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Track on Pathao Merchant Portal
              </a>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {canManage && (
                <Button
                  id="pathao-modal-refresh-btn"
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Status
                </Button>
              )}
              <Button
                id="pathao-modal-close-btn"
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
