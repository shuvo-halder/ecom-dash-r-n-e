import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Printer,
  User,
  MapPin,
  CreditCard,
  Clock,
  Send,
  UserPlus,
  Package,
  AlertCircle,
  CheckCircle2,
  Truck,
  XCircle,
  RotateCcw,
  FileText
} from "lucide-react";
import {
  getOrderById,
  updateOrderStatus,
  assignOrderStaff,
  addOrderNote
} from "../../../services/order.service";
import { getUsers } from "../../../services/user.service";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useAuth } from "../../../context/AuthContext";
import { notify } from "../../../lib/notify";
import { PathaoShipmentCard } from "../../../components/admin/orders/PathaoShipmentCard";

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Staff members for assignment
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");

  // New Note State
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Status Modal State
  const [newStatus, setNewStatus] = useState("");
  const [newPaymentStatus, setNewPaymentStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Print Slip Modal State
  const [printType, setPrintType] = useState<"invoice" | "packing_slip" | null>(null);

  const fetchOrderDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getOrderById(id);
      setOrder(data);
      setNewStatus(data.status);
      setNewPaymentStatus(data.paymentStatus || "Unpaid");
      setSelectedStaff(data.assignedStaffId || "");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load order details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const data = await getUsers({ limit: 100 });
      setStaffList(data.users || []);
    } catch (err) {
      console.error("Failed to fetch staff members", err);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
    fetchStaffMembers();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateOrderStatus(id, {
        status: newStatus,
        paymentStatus: newPaymentStatus,
      });
      setOrder(updated);
      notify.success("Order Updated", `Status changed to ${newStatus} (${newPaymentStatus}).`);
    } catch (err: any) {
      notify.apiError(err, "Failed to update order status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignStaff = async (staffId: string) => {
    if (!id) return;
    try {
      const updated = await assignOrderStaff(id, staffId || null);
      setOrder(updated);
      setSelectedStaff(staffId);
      notify.success("Staff Assigned", staffId ? "Staff member has been assigned to this order." : "Staff assignment removed.");
    } catch (err: any) {
      notify.apiError(err, "Failed to assign staff.");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    setSubmittingNote(true);
    try {
      await addOrderNote(id, newNote);
      setNewNote("");
      notify.success("Note Added", "Internal order note recorded.");
      fetchOrderDetails();
    } catch (err: any) {
      notify.apiError(err, "Failed to add internal note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st?.toLowerCase()) {
      case "pending":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"><Clock className="w-3.5 h-3.5" /> Pending</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing</span>;
      case "packed":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800"><Package className="w-3.5 h-3.5" /> Packed</span>;
      case "shipped":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800"><Truck className="w-3.5 h-3.5" /> Shipped</span>;
      case "delivered":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3.5 h-3.5" /> Delivered</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><XCircle className="w-3.5 h-3.5" /> Cancelled</span>;
      case "refunded":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800"><RotateCcw className="w-3.5 h-3.5" /> Refunded</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{st}</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="font-medium text-base">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-lg bg-rose-50 text-rose-700 flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8" />
          <p className="font-semibold">{error || "Order not found"}</p>
        </div>
        <Button onClick={() => navigate("/orders")} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/orders")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{order.orderNumber}</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrintType("invoice")} className="gap-2">
            <Printer className="w-4 h-4" /> Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintType("packing_slip")} className="gap-2">
            <FileText className="w-4 h-4" /> Packing Slip
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Order Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-foreground">{item.product?.name || "Product Item"}</p>
                        {item.product?.sku && <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>}
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{item.quantity}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        ৳{Number(item.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        ৳{(item.quantity * Number(item.price)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t pt-3 space-y-1 text-sm text-right">
              <div className="flex justify-end gap-6 text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-medium text-foreground">৳{Number(order.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-6 font-bold text-base text-foreground pt-2 border-t">
                <span>Total Amount:</span>
                <span className="text-primary">৳{Number(order.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Order Activity Timeline
            </h3>

            {order.timeline && order.timeline.length > 0 ? (
              <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-6">
                {order.timeline.map((entry: any, index: number) => (
                  <div key={entry.id || index} className="relative">
                    <span className="absolute -left-[31px] top-1 bg-background border-2 border-primary rounded-full w-3 h-3" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{entry.action}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {entry.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        By {entry.userName || "System"} • {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No timeline activity recorded yet.</p>
            )}
          </div>

          {/* Internal Notes Section */}
          <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Internal Notes
            </h3>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={3}
                placeholder="Type an internal note regarding this order..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full p-3 rounded-md border border-input text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={submittingNote || !newNote.trim()} className="gap-2">
                  <Send className="w-3.5 h-3.5" /> Post Note
                </Button>
              </div>
            </form>

            <div className="space-y-3 pt-2 border-t">
              {order.orderNotes && order.orderNotes.length > 0 ? (
                order.orderNotes.map((noteItem: any) => (
                  <div key={noteItem.id} className="p-3 bg-muted/30 border rounded-md text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>{noteItem.author || "Admin"}</span>
                      <span>{new Date(noteItem.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground text-sm font-normal">{noteItem.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No internal notes posted.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column (1 col) */}
        <div className="space-y-6">
          {/* Quick Actions / Status Update */}
          <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-base">Update Order Status</h3>
            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Order Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Packed">Packed</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Payment Status
                </label>
                <select
                  value={newPaymentStatus}
                  onChange={(e) => setNewPaymentStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              {hasPermission("Orders", "write") && (
                <Button type="submit" disabled={updatingStatus} className="w-full">
                  {updatingStatus ? "Saving..." : "Save Status Change"}
                </Button>
              )}
            </form>
          </div>

          {/* Pathao Courier Dispatch & Shipment Management */}
          <PathaoShipmentCard
            order={order}
            onOrderUpdated={fetchOrderDetails}
            canManage={hasPermission("Orders", "write")}
          />

          {/* Assign Staff */}
          <div className="bg-card border rounded-lg p-5 space-y-3 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Staff Assignment
            </h3>
            <div className="space-y-2">
              <select
                value={selectedStaff}
                onChange={(e) => handleAssignStaff(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {staffList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName || ""} ({user.role?.name || "Staff"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-card border rounded-lg p-5 space-y-3 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2 border-b pb-2">
              <User className="w-4 h-4 text-primary" /> Customer Info
            </h3>
            {order.customer ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-foreground">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{order.customer.email}</p>
                {order.customer.phone && (
                  <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                )}
                <div className="pt-2">
                  <Link
                    to={`/customers/${order.customer.id}`}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    View Customer Profile →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Guest Customer</p>
            )}
          </div>

          {/* Shipping & Billing Address */}
          <div className="bg-card border rounded-lg p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-base flex items-center gap-2 border-b pb-2">
              <MapPin className="w-4 h-4 text-primary" /> Delivery & Billing
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-muted-foreground uppercase mb-0.5">Shipping Address</p>
                <p className="text-foreground whitespace-pre-wrap">
                  {order.shippingAddress || "123 Tech Blvd, Suite 100, San Francisco, CA 94107"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase mb-0.5">Billing Address</p>
                <p className="text-foreground whitespace-pre-wrap">
                  {order.billingAddress || "123 Tech Blvd, Suite 100, San Francisco, CA 94107"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase mb-0.5">Payment Method</p>
                <p className="text-foreground">{order.paymentMethod || "Credit Card"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Slip Modal */}
      {printType && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-lg font-bold">
                {printType === "invoice" ? "Official Tax Invoice" : "Packing Slip"} - {order.orderNumber}
              </h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => window.print()} className="gap-2">
                  <Printer className="w-4 h-4" /> Print Document
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPrintType(null)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-6 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">E-Commerce Enterprise Inc.</h2>
                  <p className="text-xs text-muted-foreground">100 Enterprise Way, Suite 400</p>
                  <p className="text-xs text-muted-foreground">San Francisco, CA 94107</p>
                  <p className="text-xs text-muted-foreground">support@enterprise-ecommerce.com</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">Status: {order.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1">Customer / Shipping Address</h4>
                  <p className="font-medium">{order.customer?.firstName} {order.customer?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
                  <p className="text-xs whitespace-pre-wrap">{order.shippingAddress || "123 Tech Blvd, Suite 100, San Francisco, CA 94107"}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1">Payment Method</h4>
                  <p className="font-medium">{order.paymentMethod || "Credit Card"}</p>
                  <p className="text-xs text-muted-foreground">Payment Status: {order.paymentStatus || "Paid"}</p>
                </div>
              </div>

              <table className="w-full text-left border-t border-b">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground font-semibold">
                    <th className="py-2 px-2">Item</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    {printType === "invoice" && <th className="py-2 px-2 text-right">Price</th>}
                    {printType === "invoice" && <th className="py-2 px-2 text-right">Subtotal</th>}
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {order.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-2 font-medium">{item.product?.name || "Product"}</td>
                      <td className="py-2 px-2 text-center">{item.quantity}</td>
                      {printType === "invoice" && <td className="py-2 px-2 text-right">৳{Number(item.price).toFixed(2)}</td>}
                      {printType === "invoice" && <td className="py-2 px-2 text-right">৳{(item.quantity * Number(item.price)).toFixed(2)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>

              {printType === "invoice" && (
                <div className="flex justify-end text-sm">
                  <div className="w-48 space-y-1">
                    <div className="flex justify-between font-bold text-base border-t pt-1">
                      <span>Total Amount:</span>
                      <span className="text-primary">৳{Number(order.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
