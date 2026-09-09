import React, { useState, useEffect } from "react";
import {
  Truck,
  X,
  AlertCircle,
  Loader2,
  Building,
  MapPin,
  User,
  Phone,
  Banknote,
  Scale,
  FileText
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  getPathaoStores,
  getPathaoCities,
  getPathaoZones,
  getPathaoAreas,
  createPathaoShipment,
  PathaoStore,
  PathaoCity,
  PathaoZone,
  PathaoArea
} from "../../../services/pathao.service";
import { notify } from "../../../lib/notify";

interface CreatePathaoShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess: (shipment: any) => void;
}

export function CreatePathaoShipmentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: CreatePathaoShipmentModalProps) {
  // Dropdown options
  const [stores, setStores] = useState<PathaoStore[]>([]);
  const [cities, setCities] = useState<PathaoCity[]>([]);
  const [zones, setZones] = useState<PathaoZone[]>([]);
  const [areas, setAreas] = useState<PathaoArea[]>([]);

  // Loading states
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [selectedStore, setSelectedStore] = useState<number | "">("");
  const [selectedCity, setSelectedCity] = useState<number | "">("");
  const [selectedZone, setSelectedZone] = useState<number | "">("");
  const [selectedArea, setSelectedArea] = useState<number | "">("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [codAmount, setCodAmount] = useState<number>(0);
  const [itemWeight, setItemWeight] = useState<number>(0.5);
  const [specialInstruction, setSpecialInstruction] = useState("");

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen || !order) return;

    setError(null);

    // Derive recipient name
    const name = order.customer
      ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim()
      : "";
    setRecipientName(name);

    // Derive recipient phone
    setRecipientPhone(order.customer?.phone || "");

    // Derive address
    setRecipientAddress(order.shippingAddress || "");

    // Derive COD amount: if order payment is already Paid, COD should be 0; otherwise order total
    const isPaid = order.paymentStatus?.toLowerCase() === "paid";
    const initialCod = isPaid ? 0 : Number(order.totalAmount || 0);
    setCodAmount(initialCod);

    setItemWeight(0.5);
    setSpecialInstruction("");

    // Fetch initial stores and cities
    const fetchDropdowns = async () => {
      setLoadingInitial(true);
      try {
        const [storesData, citiesData] = await Promise.all([
          getPathaoStores(),
          getPathaoCities(),
        ]);

        setStores(storesData);
        if (storesData.length > 0) {
          setSelectedStore(storesData[0].store_id);
        }

        setCities(citiesData);
      } catch (err: any) {
        console.error("Failed to load initial Pathao options", err);
        setError("Failed to load Pathao store or city options. Please check credentials or network.");
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchDropdowns();
  }, [isOpen, order]);

  // Load zones when city changes
  const handleCityChange = async (cityId: number) => {
    setSelectedCity(cityId);
    setSelectedZone("");
    setSelectedArea("");
    setZones([]);
    setAreas([]);

    if (!cityId) return;

    setLoadingZones(true);
    try {
      const zonesData = await getPathaoZones(cityId);
      setZones(zonesData);
    } catch (err: any) {
      console.error("Failed to load zones", err);
      notify.apiError(err, "Failed to load zones for selected city.");
    } finally {
      setLoadingZones(false);
    }
  };

  // Load areas when zone changes
  const handleZoneChange = async (zoneId: number) => {
    setSelectedZone(zoneId);
    setSelectedArea("");
    setAreas([]);

    if (!zoneId) return;

    setLoadingAreas(true);
    try {
      const areasData = await getPathaoAreas(zoneId);
      setAreas(areasData);
    } catch (err: any) {
      console.error("Failed to load areas", err);
      notify.apiError(err, "Failed to load areas for selected zone.");
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedStore) {
      setError("Please select a merchant pickup store.");
      return;
    }
    if (!selectedCity) {
      setError("Please select a delivery city.");
      return;
    }
    if (!selectedZone) {
      setError("Please select a delivery zone.");
      return;
    }
    if (!selectedArea) {
      setError("Please select a delivery area.");
      return;
    }
    if (!recipientName.trim()) {
      setError("Recipient name is required.");
      return;
    }
    if (!recipientPhone.trim()) {
      setError("Recipient contact phone is required.");
      return;
    }
    if (!recipientAddress.trim()) {
      setError("Detailed delivery address is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        store_id: Number(selectedStore),
        recipient_city: Number(selectedCity),
        recipient_zone: Number(selectedZone),
        recipient_area: Number(selectedArea),
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        recipient_address: recipientAddress.trim(),
        cod_amount: Number(codAmount || 0),
        item_weight: Number(itemWeight || 0.5),
        special_instruction: specialInstruction.trim() || undefined,
      };

      const shipment = await createPathaoShipment(order.id, payload);
      notify.success(
        "Pathao Shipment Created",
        `Consignment ID: ${shipment.consignmentId || shipment.trackingNumber || "Assigned"}`
      );
      onSuccess(shipment);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create shipment.";
      setError(msg);
      notify.apiError(err, "Shipment creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Duplicate shipment check
  const hasActiveShipment = order.shipments?.some(
    (s: any) => s.provider === "pathao" && s.status !== "CANCELLED" && s.status !== "FAILED_DELIVERY"
  );

  return (
    <div
      id="create-pathao-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <Card className="w-full max-w-2xl shadow-2xl border-border bg-background my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 px-6 pt-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Create Pathao Shipment</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dispatch Order <span className="font-semibold text-foreground">{order.orderNumber}</span> to Pathao Courier
              </p>
            </div>
          </div>
          <Button
            id="create-pathao-close-btn"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {hasActiveShipment && (
            <div className="flex items-center gap-3 p-3.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Notice:</strong> This order already has an active Pathao shipment record. Creating another may generate duplicate consignments.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingInitial ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading Pathao merchant settings & locations...</p>
            </div>
          ) : (
            <form id="create-pathao-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Pickup Store Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" /> Merchant Pickup Store *
                </label>
                <select
                  id="pathao-store-select"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring"
                  required
                >
                  <option value="">Select Pickup Store</option>
                  {stores.map((st) => (
                    <option key={st.store_id} value={st.store_id}>
                      {st.store_name} ({st.store_address})
                    </option>
                  ))}
                </select>
                {stores.length === 0 && (
                  <p className="text-[11px] text-amber-600">
                    No active stores found in Pathao. Ensure merchant stores are configured in your Pathao merchant portal.
                  </p>
                )}
              </div>

              {/* Geographic Routing Hierarchy: City -> Zone -> Area */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/70 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Pathao Delivery Destination *
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* City */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">City</label>
                    <select
                      id="pathao-city-select"
                      value={selectedCity}
                      onChange={(e) => handleCityChange(Number(e.target.value))}
                      className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring"
                      required
                    >
                      <option value="">Select City</option>
                      {cities.map((c) => (
                        <option key={c.city_id} value={c.city_id}>
                          {c.city_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Zone */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Zone</span>
                      {loadingZones && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </label>
                    <select
                      id="pathao-zone-select"
                      value={selectedZone}
                      onChange={(e) => handleZoneChange(Number(e.target.value))}
                      disabled={!selectedCity || loadingZones}
                      className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring disabled:opacity-50"
                      required
                    >
                      <option value="">{selectedCity ? "Select Zone" : "Select City first"}</option>
                      {zones.map((z) => (
                        <option key={z.zone_id} value={z.zone_id}>
                          {z.zone_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Area */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Area</span>
                      {loadingAreas && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </label>
                    <select
                      id="pathao-area-select"
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(Number(e.target.value))}
                      disabled={!selectedZone || loadingAreas}
                      className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring disabled:opacity-50"
                      required
                    >
                      <option value="">{selectedZone ? "Select Area" : "Select Zone first"}</option>
                      {areas.map((a) => (
                        <option key={a.area_id} value={a.area_id}>
                          {a.area_name} {a.home_delivery_available ? "" : "(Pickup only)"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Specific Street Address */}
                <div className="pt-1">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Detailed Recipient Street Address *
                  </label>
                  <textarea
                    id="pathao-address-input"
                    rows={2}
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="House, Road, Block, Landmark..."
                    className="w-full p-2.5 rounded-md border border-input text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Recipient Name *
                  </label>
                  <Input
                    id="pathao-recipient-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Full Customer Name"
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Recipient Phone *
                  </label>
                  <Input
                    id="pathao-recipient-phone"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    required
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Standard 11-digit Bangladesh phone number</p>
                </div>
              </div>

              {/* COD and Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Cash on Delivery (COD) Amount (৳)
                  </label>
                  <Input
                    id="pathao-cod-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={codAmount}
                    onChange={(e) => setCodAmount(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {order.paymentStatus?.toLowerCase() === "paid"
                      ? "Order is marked Paid; COD is defaulted to ৳0."
                      : `Unpaid order total: ৳${Number(order.totalAmount || 0).toFixed(2)}`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-primary" /> Package Weight (kg)
                  </label>
                  <Input
                    id="pathao-item-weight"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={itemWeight}
                    onChange={(e) => setItemWeight(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Default 0.5kg for standard parcel delivery</p>
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Special Delivery Instructions (Optional)
                </label>
                <Input
                  id="pathao-special-instruction"
                  value={specialInstruction}
                  onChange={(e) => setSpecialInstruction(e.target.value)}
                  placeholder="e.g. Call before delivery, handle with care"
                  className="h-9 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t">
                <Button
                  id="pathao-cancel-btn"
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  id="pathao-submit-btn"
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || stores.length === 0}
                  className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Consignment...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      Confirm & Dispatch to Pathao
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
