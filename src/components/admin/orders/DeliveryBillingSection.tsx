import React, { useState } from "react";
import {
  Truck,
  MapPin,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Package,
  Receipt,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  User,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { notify } from "../../../lib/notify";

interface DeliveryBillingSectionProps {
  order: any;
}

export function DeliveryBillingSection({ order }: DeliveryBillingSectionProps) {
  const [copiedTracking, setCopiedTracking] = useState(false);

  if (!order) return null;

  // Derive recipient details
  const customerName = order.customer
    ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || order.customer.email
    : "Guest Customer";
  const customerPhone = order.customer?.phone || null;
  const customerEmail = order.customer?.email || order.customerEmail || null;
  const shippingAddress = order.shippingAddress || null;
  const billingAddress = order.billingAddress || null;

  // Active shipment resolution
  const allShipments = (order.shipments || []).filter((s: any) => !s.deletedAt);
  const activeShipment =
    allShipments.find((s: any) => s.status !== "CANCELLED" && s.status !== "FAILED_DELIVERY") ||
    allShipments[0] ||
    null;

  const courierName =
    activeShipment?.courier?.name ||
    (activeShipment?.provider === "pathao"
      ? "Pathao Courier"
      : activeShipment?.provider === "manual"
      ? "Manual Courier"
      : activeShipment?.provider
      ? `${activeShipment.provider.toUpperCase()} Courier`
      : null);

  const trackingRef = activeShipment?.trackingNumber || activeShipment?.consignmentId || null;
  const trackingUrl =
    activeShipment?.trackingUrl ||
    (activeShipment?.provider === "pathao" && trackingRef
      ? `https://merchant.pathao.com/tracking?consignment_id=${trackingRef}`
      : null);

  // Authoritative financial calculations matching backend logic
  const subtotal =
    order.subtotal !== undefined && order.subtotal !== null
      ? Number(order.subtotal)
      : Array.isArray(order.items)
      ? order.items.reduce(
          (sum: number, it: any) => sum + (it.quantity || 1) * Number(it.price || 0),
          0
        )
      : Number(order.totalAmount || 0);

  const shippingFee = Number(order.shippingFee ?? order.shippingCost ?? 0);
  const discountAmount = Number(order.discountAmount ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  const totalAmount = Number(order.totalAmount || 0);

  const isPaid = order.paymentStatus?.toLowerCase() === "paid";
  const paidAmount = isPaid
    ? totalAmount
    : Array.isArray(order.payments)
    ? order.payments
        .filter((p: any) => p.status === "PAID" || p.status === "COMPLETED")
        .reduce(
          (sum: number, p: any) => sum + (Number(p.amount || 0) - Number(p.refundedAmount || 0)),
          0
        )
    : 0;

  const dueAmount = isPaid ? 0 : Math.max(0, totalAmount - paidAmount);

  // Shipment delivery fee vs Order shipping charge
  const shipmentDeliveryFee =
    activeShipment && activeShipment.deliveryFee !== undefined && activeShipment.deliveryFee !== null
      ? Number(activeShipment.deliveryFee)
      : null;

  const handleCopyTracking = () => {
    if (trackingRef) {
      navigator.clipboard.writeText(trackingRef);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
      notify.success("Copied tracking reference", trackingRef);
    }
  };

  const getShipmentBadge = (status?: string) => {
    if (!status) {
      return (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground text-[11px]">
          No shipment created
        </Badge>
      );
    }
    switch (status.toUpperCase()) {
      case "DELIVERED":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Delivered
          </Badge>
        );
      case "SHIPPED":
      case "IN_TRANSIT":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[11px]">
            <Truck className="w-3 h-3 mr-1" /> {status.replace("_", " ")}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px]">
            <XCircle className="w-3 h-3 mr-1" /> Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px]">
            <Clock className="w-3 h-3 mr-1" /> {status.replace("_", " ")}
          </Badge>
        );
    }
  };

  const getPaymentBadge = (status?: string) => {
    const s = (status || "Unpaid").toLowerCase();
    if (s === "paid") {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
          <ShieldCheck className="w-3 h-3 mr-1" /> Paid
        </Badge>
      );
    }
    if (s === "refunded") {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px]">
          <XCircle className="w-3 h-3 mr-1" /> Refunded
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px]">
        <Clock className="w-3 h-3 mr-1" /> Unpaid
      </Badge>
    );
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
          <Truck className="w-5 h-5 text-primary" /> Delivery & Billing
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          Order #{order.orderNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sub-section 1: Delivery Information */}
        <div className="space-y-4 bg-muted/20 border border-border/70 rounded-lg p-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <MapPin className="w-4 h-4 text-primary" /> Delivery Information
            </h4>
            {getShipmentBadge(activeShipment?.status)}
          </div>

          <div className="space-y-3 text-xs">
            {/* Delivery Method & Shipping Charge */}
            <div className="grid grid-cols-2 gap-2 bg-background p-2.5 rounded-md border border-border/50">
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Delivery Method</span>
                <span className="font-medium text-foreground">
                  {courierName ? "Courier Delivery" : "Standard Shipping"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Customer Shipping Charge</span>
                <span className="font-semibold text-foreground font-mono">
                  ৳{shippingFee.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Courier & Tracking Details */}
            <div className="space-y-2 bg-background p-2.5 rounded-md border border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Assigned Courier:</span>
                <span className="font-medium text-foreground">
                  {courierName || "Not assigned"}
                </span>
              </div>

              {activeShipment ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Consignment ID:</span>
                    <span className="font-mono text-foreground">
                      {activeShipment.consignmentId || "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tracking Reference:</span>
                    {trackingRef ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-foreground">{trackingRef}</span>
                        <button
                          type="button"
                          onClick={handleCopyTracking}
                          title="Copy tracking reference"
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                        >
                          {copiedTracking ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {trackingUrl && (
                    <div className="flex justify-end pt-1">
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        Track Shipment Live <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {shipmentDeliveryFee !== null && (
                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/60">
                      <span className="text-muted-foreground">Shipment Delivery Fee:</span>
                      <span className="font-mono font-medium text-foreground">
                        ৳{shipmentDeliveryFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground pt-1 italic">
                  No shipment created. Dispatch this order when items are packed.
                </p>
              )}
            </div>

            {/* Delivery Recipient & Address */}
            <div className="bg-background p-2.5 rounded-md border border-border/50 space-y-1.5">
              <span className="text-muted-foreground block text-[11px] font-semibold uppercase tracking-wider">
                Delivery Address & Recipient
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{customerName}</span>
              </div>
              {customerPhone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerPhone}</span>
                </div>
              )}
              <div className="flex items-start gap-1.5 text-muted-foreground pt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {shippingAddress || "Standard Delivery Address not specified"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-section 2: Billing Information */}
        <div className="space-y-4 bg-muted/20 border border-border/70 rounded-lg p-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <Receipt className="w-4 h-4 text-primary" /> Billing Information
            </h4>
            {getPaymentBadge(order.paymentStatus)}
          </div>

          <div className="space-y-3 text-xs">
            {/* Payment Method & Status */}
            <div className="grid grid-cols-2 gap-2 bg-background p-2.5 rounded-md border border-border/50">
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Payment Method</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {order.paymentMethod || "Cash on Delivery"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Payment State</span>
                <span className="font-medium text-foreground">
                  {order.paymentStatus || "Unpaid"}
                </span>
              </div>
            </div>

            {/* Billing Address & Customer */}
            <div className="bg-background p-2.5 rounded-md border border-border/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground block text-[11px] font-semibold uppercase tracking-wider">
                  Billing Address
                </span>
                {!billingAddress && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Same as Delivery Address
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{customerName}</span>
              </div>
              {customerEmail && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerEmail}</span>
                </div>
              )}
              {customerPhone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerPhone}</span>
                </div>
              )}
              <div className="flex items-start gap-1.5 text-muted-foreground pt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {billingAddress || shippingAddress || "Same as delivery address"}
                </span>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-background p-3 rounded-md border border-border/50 space-y-1.5">
              <span className="text-muted-foreground block text-[11px] font-semibold uppercase tracking-wider pb-1 border-b border-border/40">
                Financial Summary
              </span>
              <div className="flex justify-between text-muted-foreground pt-0.5">
                <span>Product Subtotal:</span>
                <span className="font-mono font-medium text-foreground">৳{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount {order.coupon?.code ? `(${order.coupon.code})` : ""}:</span>
                  <span className="font-mono font-medium">-৳{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping Charge:</span>
                <span className="font-mono font-medium text-foreground">৳{shippingFee.toFixed(2)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax / VAT:</span>
                  <span className="font-mono font-medium text-foreground">+৳{taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-border/60">
                <span>Order Total:</span>
                <span className="font-mono text-primary">৳{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Paid Amount:</span>
                <span className="font-mono text-emerald-600 font-medium">৳{paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-xs pt-1 border-t border-dashed border-border/60">
                <span className="text-foreground">Due Amount (Collectable):</span>
                <span className={`font-mono ${dueAmount > 0 ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                  ৳{dueAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
