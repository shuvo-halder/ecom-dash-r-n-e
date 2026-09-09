import React, { useState, useEffect } from "react";
import {
  Truck,
  X,
  AlertCircle,
  Loader2,
  Check,
  PackageCheck,
  FileText,
  Banknote,
  MapPin,
  User,
  Phone,
  HelpCircle,
  Layers,
  AlertTriangle
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { createShipment } from "../../../services/shipment.service";
import { notify } from "../../../lib/notify";

interface CreateShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess: (shipment: any) => void;
}

export function CreateShipmentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: CreateShipmentModalProps) {
  // Provider selection: "manual" or "pathao"
  const [provider, setProvider] = useState<string>("manual");

  // Form fields
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");
  const [shipmentStatus, setShipmentStatus] = useState<string>("SHIPPED");

  // Selected item quantities: { [orderItemId: string]: number }
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  // Loading & error states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Initialize form fields when modal opens
  useEffect(() => {
    if (!isOpen || !order) return;

    setErrorMessage(null);
    setErrorCode(null);
    setProvider("manual");
    setTrackingNumber("");
    setDeliveryFee(order.shippingCost ? Number(order.shippingCost) : 60);
    setNotes("");
    setShipmentStatus("SHIPPED");

    // Initialize items with full remaining ordered quantity
    const initialItems: Record<string, number> = {};
    if (Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        initialItems[item.id] = item.quantity || 1;
      });
    }
    setSelectedItems(initialItems);
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  // Derive recipient details
  const customerName = order.customer
    ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || order.customer.email
    : "Guest Customer";
  const customerPhone = order.customer?.phone || "N/A";
  const shippingAddress = order.shippingAddress || "Standard Delivery Address";
  const isPaid = order.paymentStatus?.toLowerCase() === "paid";
  const codAmount = isPaid ? 0 : Number(order.totalAmount || 0);

  // Item toggle / quantity helpers
  const handleQuantityChange = (itemId: string, qty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(qty, maxQty));
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: clamped,
    }));
  };

  const handleToggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) > 0 ? 0 : maxQty,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);

    // Build items payload
    const itemsPayload = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
      }));

    if (itemsPayload.length === 0) {
      setErrorMessage("Please select at least one item and quantity to dispatch.");
      return;
    }

    // Generate idempotency key for this dispatch attempt
    const idempotencyKey = `ord-${order.id}-${provider}-${Date.now()}`;

    setIsSubmitting(true);
    try {
      const payload: any = {
        orderId: order.id,
        provider,
        idempotencyKey,
        items: itemsPayload,
        notes: notes.trim() || undefined,
        status: shipmentStatus,
      };

      if (trackingNumber.trim()) {
        payload.trackingNumber = trackingNumber.trim();
      }

      if (deliveryFee !== "" && Number(deliveryFee) >= 0) {
        payload.deliveryFee = Number(deliveryFee);
      }

      const shipment = await createShipment(payload);

      notify.success(
        "Shipment Created Successfully",
        `Dispatched via ${provider === "manual" ? "Manual Courier" : "Pathao Courier"} (Tracking: ${
          shipment.trackingNumber || shipment.consignmentId || "N/A"
        })`
      );

      onSuccess(shipment);
      onClose();
    } catch (err: any) {
      const respData = err.response?.data;
      const code = respData?.code || respData?.errorCode || err.code || "SHIPMENT_ERROR";
      const message =
        respData?.message || respData?.error || err.message || "Failed to create shipment.";

      setErrorCode(code);
      setErrorMessage(message);

      if (code === "PATHAO_NOT_CONFIGURED") {
        notify.error("Pathao Not Configured", message);
      } else if (code === "ACTIVE_SHIPMENT_EXISTS") {
        notify.error("Active Shipment Exists", message);
      } else {
        notify.apiError(err, "Failed to create shipment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-shipment-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        id="create-shipment-modal-content"
        className="relative bg-card text-card-foreground border border-border w-full max-w-2xl rounded-xl shadow-2xl my-8 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Create Shipment</h2>
              <p className="text-xs text-muted-foreground">
                Order #{order.orderNumber} • Select Courier Provider & Dispatch
              </p>
            </div>
          </div>
          <button
            id="btn-close-shipment-modal"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div
              id="shipment-error-banner"
              className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3 animate-in fade-in-50"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">
                  {errorCode ? `Error: ${errorCode}` : "Shipment Creation Failed"}
                </div>
                <div>{errorMessage}</div>
                {errorCode === "PATHAO_NOT_CONFIGURED" && (
                  <p className="text-xs opacity-90 pt-1">
                    Tip: Switch to <strong>Manual Courier</strong> below or configure Pathao credentials in{" "}
                    <strong>Settings &gt; Shipping</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Select Courier Provider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Select Courier Provider
              </label>
              <span className="text-xs text-muted-foreground">Provider-agnostic dispatch</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Manual Courier Card */}
              <div
                id="provider-card-manual"
                onClick={() => setProvider("manual")}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  provider === "manual"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border hover:border-border/80 bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      Manual Courier
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Ready
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      In-house delivery or custom courier with manual tracking reference.
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="courierProvider"
                    value="manual"
                    checked={provider === "manual"}
                    onChange={() => setProvider("manual")}
                    className="h-4 w-4 text-primary focus:ring-primary mt-1"
                  />
                </div>
              </div>

              {/* Pathao Courier Card */}
              <div
                id="provider-card-pathao"
                onClick={() => setProvider("pathao")}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  provider === "pathao"
                    ? "border-amber-500 bg-amber-500/5 shadow-xs"
                    : "border-border hover:border-border/80 bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      Pathao Courier
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                        Not Configured
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automated third-party API dispatch (requires credentials in Settings).
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="courierProvider"
                    value="pathao"
                    checked={provider === "pathao"}
                    onChange={() => setProvider("pathao")}
                    className="h-4 w-4 text-amber-500 focus:ring-amber-500 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Notice if Pathao selected */}
            {provider === "pathao" && (
              <div
                id="pathao-unconfigured-notice"
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Pathao Integration Status:</strong> Pathao API is not currently configured.
                  Submitting this form with Pathao will invoke the provider adapter and return{" "}
                  <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">PATHAO_NOT_CONFIGURED</code>{" "}
                  without creating a fake shipment or altering order status.
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Provider Details & Shipment Parameters */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold">Shipment Parameters</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tracking Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Tracking Number / Reference
                </label>
                <Input
                  id="input-tracking-number"
                  placeholder={
                    provider === "manual"
                      ? "Leave blank to auto-generate (MAN-...)"
                      : "Handled by Pathao Consignment"
                  }
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={provider === "pathao"}
                  className="text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {provider === "manual"
                    ? "Optional. Auto-generated if omitted."
                    : "Assigned by Pathao on dispatch."}
                </p>
              </div>

              {/* Delivery Fee */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Delivery Fee (৳ BDT)
                </label>
                <Input
                  id="input-delivery-fee"
                  type="number"
                  min="0"
                  placeholder="e.g. 60"
                  value={deliveryFee}
                  onChange={(e) =>
                    setDeliveryFee(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Recorded on shipment record.
                </p>
              </div>
            </div>

            {/* Notes / Special Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Dispatch Notes / Special Instructions
              </label>
              <Input
                id="input-shipment-notes"
                placeholder="e.g. Fragile package, call recipient prior to delivery"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* STEP 3: Order Items Selection */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" />
                Items to Dispatch
              </label>
              <span className="text-xs text-muted-foreground">
                {Object.values(selectedItems).reduce((sum, q) => sum + q, 0)} items selected
              </span>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {Array.isArray(order.items) && order.items.length > 0 ? (
                order.items.map((item: any) => {
                  const currentQty = selectedItems[item.id] || 0;
                  const maxQty = item.quantity || 1;
                  const isChecked = currentQty > 0;

                  return (
                    <div
                      key={item.id}
                      className="p-3 flex items-center justify-between gap-4 text-sm hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.id, maxQty)}
                          className="h-4 w-4 rounded text-primary focus:ring-primary"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {item.productName || item.product?.name || "Order Item"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Unit Price: ৳{Number(item.price || 0).toLocaleString()} • Ordered: {maxQty}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">Qty:</span>
                        <Input
                          type="number"
                          min="0"
                          max={maxQty}
                          value={currentQty}
                          onChange={(e) =>
                            handleQuantityChange(item.id, parseInt(e.target.value, 10) || 0, maxQty)
                          }
                          disabled={!isChecked}
                          className="w-16 h-8 text-center text-xs"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No items found in this order.
                </div>
              )}
            </div>
          </div>

          {/* STEP 4: Recipient & COD Overview */}
          <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2 text-xs">
            <div className="font-medium text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {customerName}
              </span>
              <span className="font-semibold text-primary">
                COD: ৳{codAmount.toLocaleString()} {isPaid && "(Paid)"}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{customerPhone}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{shippingAddress}</span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              id="btn-cancel-shipment-modal"
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              id="btn-submit-create-shipment"
              type="submit"
              disabled={isSubmitting}
              className={`min-w-[140px] ${
                provider === "pathao" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : provider === "pathao" ? (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Dispatch via Pathao
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Dispatch Shipment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
