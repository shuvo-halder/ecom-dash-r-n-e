import React, { useState, useEffect } from "react";
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Globe,
  Save,
  RotateCw,
  ShieldCheck,
  Zap,
  Info,
  Layers,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { LoadingSpinner } from "../../ui/LoadingSpinner";
import {
  listCourierProviders,
  updateCourierProvider,
  testCourierConnection,
  setActiveCourierProvider,
  CourierProviderInfo,
  ProviderHealthResponse,
} from "../../../services/courier.service";

export const CourierProvidersSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string>("manual");
  const [providers, setProviders] = useState<CourierProviderInfo[]>([]);

  // Pathao editable configuration form
  const [pathaoForm, setPathaoForm] = useState({
    enabled: false,
    baseURL: "https://api-hermes.pathao.com",
    clientId: "",
    clientSecret: "",
    username: "",
    password: "",
    webhookSecret: "",
    defaultStoreId: "",
  });

  // Manual editable configuration form
  const [manualForm, setManualForm] = useState({
    enabled: true,
    defaultCourierName: "In-House Courier",
  });

  // Action status states
  const [savingPathao, setSavingPathao] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderHealthResponse | null>>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const data = await listCourierProviders();
      setActiveProvider(data.activeProvider || "manual");
      setProviders(data.providers || []);

      const pathaoProv = data.providers?.find((p) => p.id === "pathao");
      if (pathaoProv) {
        setPathaoForm({
          enabled: pathaoProv.isEnabled,
          baseURL: pathaoProv.safeConfig?.baseURL || "https://api-hermes.pathao.com",
          clientId: pathaoProv.safeConfig?.clientId || "",
          clientSecret: pathaoProv.safeConfig?.clientSecretMasked || "",
          username: pathaoProv.safeConfig?.username || "",
          password: pathaoProv.safeConfig?.passwordMasked || "",
          webhookSecret: pathaoProv.safeConfig?.webhookSecretMasked || "",
          defaultStoreId: pathaoProv.safeConfig?.defaultStoreId
            ? String(pathaoProv.safeConfig.defaultStoreId)
            : "",
        });
      }

      const manualProv = data.providers?.find((p) => p.id === "manual");
      if (manualProv) {
        setManualForm({
          enabled: manualProv.isEnabled,
          defaultCourierName: manualProv.safeConfig?.defaultCourierName || "In-House Courier",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.response?.data?.message || "Failed to load courier providers.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSetActive = async (providerId: string) => {
    try {
      await setActiveCourierProvider(providerId);
      setActiveProvider(providerId);
      setNotification({
        type: "success",
        message: `Default courier set to ${providerId === "manual" ? "Manual Dispatch" : "Pathao Courier"}.`,
      });
      fetchProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.response?.data?.message || "Failed to set active courier.",
      });
    }
  };

  const handleSavePathao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPathao(true);
    setNotification(null);
    try {
      await updateCourierProvider("pathao", {
        enabled: pathaoForm.enabled,
        baseURL: pathaoForm.baseURL,
        clientId: pathaoForm.clientId,
        clientSecret: pathaoForm.clientSecret,
        username: pathaoForm.username,
        password: pathaoForm.password,
        webhookSecret: pathaoForm.webhookSecret,
        defaultStoreId: pathaoForm.defaultStoreId ? Number(pathaoForm.defaultStoreId) : undefined,
      });

      setNotification({
        type: "success",
        message: "Pathao courier settings saved securely. Sensitive credentials masked.",
      });
      fetchProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.response?.data?.message || "Failed to save Pathao settings.",
      });
    } finally {
      setSavingPathao(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManual(true);
    setNotification(null);
    try {
      await updateCourierProvider("manual", {
        enabled: manualForm.enabled,
        defaultCourierName: manualForm.defaultCourierName,
      });

      setNotification({
        type: "success",
        message: "Manual courier configuration updated successfully.",
      });
      fetchProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.response?.data?.message || "Failed to save Manual courier settings.",
      });
    } finally {
      setSavingManual(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    setNotification(null);
    try {
      const res = await testCourierConnection(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: res }));
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        (providerId === "pathao"
          ? "PATHAO_NOT_CONFIGURED: Pathao API credentials are required. Please configure credentials."
          : "Failed to test provider connection.");
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          healthy: false,
          status: "ERROR",
          message: errorMsg,
          testedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const pathaoProvider = providers.find((p) => p.id === "pathao");
  const manualProvider = providers.find((p) => p.id === "manual");

  if (loading) {
    return <LoadingSpinner message="Loading courier provider management..." />;
  }

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      {/* Header & Section Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Courier Providers & Shipping Gateways
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage logistics providers, credentials, and dispatch automation with provider abstraction.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border">
          <span className="font-medium text-muted-foreground">Default Provider:</span>
          <span className="font-semibold text-primary capitalize">
            {activeProvider === "manual" ? "Manual / In-House" : "Pathao Courier"}
          </span>
        </div>
      </div>

      {/* Alerts / Feedback Notification */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-sm flex items-start gap-2 border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : notification.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
          }`}
        >
          {notification.type === "success" && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          {notification.type === "error" && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          {notification.type === "info" && <Info className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs underline ml-2 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PROVIDER 1: MANUAL COURIER */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-900">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Manual / In-House Courier</h4>
                  <p className="text-xs text-muted-foreground">Standard internal dispatch</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Configured
                </Badge>
                {activeProvider === "manual" && (
                  <Badge className="bg-primary text-primary-foreground text-xs">Default</Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Dispatches orders via in-house delivery fleet or arbitrary offline couriers. Allows assigning manual tracking numbers and generating standard invoices.
            </p>

            {/* Capabilities */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Supported Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Create Shipment
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Cancel Shipment
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Manual Tracking
                </span>
              </div>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSaveManual} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium block mb-1">Courier Display Label</label>
                <Input
                  value={manualForm.defaultCourierName}
                  onChange={(e) => setManualForm({ ...manualForm, defaultCourierName: e.target.value })}
                  placeholder="e.g. In-House Courier, Sundarban, SA Paribahan"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={manualForm.enabled}
                    onChange={(e) => setManualForm({ ...manualForm, enabled: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  Enable Manual Courier Provider
                </label>

                {activeProvider !== "manual" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSetActive("manual")}
                  >
                    Set as Default
                  </Button>
                )}
              </div>

              {testResults.manual && (
                <div
                  className={`p-2.5 rounded-md text-xs border ${
                    testResults.manual.healthy
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  <p className="font-medium">{testResults.manual.message}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingManual}
                  className="text-xs h-8"
                >
                  {savingManual ? <RotateCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save Manual Provider
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingId === "manual"}
                  onClick={() => handleTestConnection("manual")}
                  className="text-xs h-8"
                >
                  {testingId === "manual" ? (
                    <RotateCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 mr-1" />
                  )}
                  Test Readiness
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* PROVIDER 2: PATHAO COURIER */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-900">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Pathao Courier</h4>
                  <p className="text-xs text-muted-foreground">Automated API Merchant Logistics</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {pathaoProvider?.isConfigured ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not configured
                  </Badge>
                )}

                {pathaoForm.enabled ? (
                  <Badge className="bg-emerald-600 text-white text-[11px]">Enabled</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px]">Disabled</Badge>
                )}

                {activeProvider === "pathao" && (
                  <Badge className="bg-primary text-primary-foreground text-xs">Default</Badge>
                )}
              </div>
            </div>

            {/* Architecture / Pathao Status Notice */}
            <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Status: Not configured (Pathao-Ready Architecture)
              </div>
              <p className="leading-relaxed text-[11px] opacity-90">
                Pathao API credentials are not yet active. You may prepare and save connection details here without making live calls. When credentials are supplied, the provider abstraction will seamlessly enable automated dispatch.
              </p>
            </div>

            {/* Capabilities */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Supported Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Automated Dispatch
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Webhook Tracking Sync
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Consignment Cancel
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Rate Calculation
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ Zone Validation
                </span>
              </div>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSavePathao} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium block mb-1">API Base URL</label>
                  <Input
                    value={pathaoForm.baseURL}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, baseURL: e.target.value })}
                    placeholder="https://api-hermes.pathao.com"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Client ID</label>
                  <Input
                    value={pathaoForm.clientId}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, clientId: e.target.value })}
                    placeholder="e.g. 1234"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium block mb-1">Client Secret</label>
                  <Input
                    type="password"
                    value={pathaoForm.clientSecret}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, clientSecret: e.target.value })}
                    placeholder={pathaoProvider?.safeConfig?.hasClientSecret ? "••••••••" : "Enter Client Secret"}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Merchant Email / Username</label>
                  <Input
                    value={pathaoForm.username}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, username: e.target.value })}
                    placeholder="merchant@example.com"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium block mb-1">Password</label>
                  <Input
                    type="password"
                    value={pathaoForm.password}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, password: e.target.value })}
                    placeholder={pathaoProvider?.safeConfig?.hasPassword ? "••••••••" : "Enter Password"}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Webhook Secret (Optional)</label>
                  <Input
                    type="password"
                    value={pathaoForm.webhookSecret}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, webhookSecret: e.target.value })}
                    placeholder={pathaoProvider?.safeConfig?.hasWebhookSecret ? "••••••••" : "Enter Webhook Secret"}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Default Store ID (Optional)</label>
                <Input
                  type="number"
                  value={pathaoForm.defaultStoreId}
                  onChange={(e) => setPathaoForm({ ...pathaoForm, defaultStoreId: e.target.value })}
                  placeholder="e.g. 12"
                  className="text-xs"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={pathaoForm.enabled}
                    onChange={(e) => setPathaoForm({ ...pathaoForm, enabled: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  Enable Pathao Integration
                </label>

                {pathaoProvider?.isConfigured && activeProvider !== "pathao" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSetActive("pathao")}
                  >
                    Set as Default
                  </Button>
                )}
              </div>

              {/* Test Result Message */}
              {testResults.pathao && (
                <div
                  className={`p-2.5 rounded-md text-xs border ${
                    testResults.pathao.healthy
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  <p className="font-semibold">{testResults.pathao.message}</p>
                  <p className="text-[11px] mt-1 opacity-80">
                    Tested at: {new Date(testResults.pathao.testedAt).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingPathao}
                  className="text-xs h-8"
                >
                  {savingPathao ? <RotateCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save Pathao Config
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingId === "pathao"}
                  onClick={() => handleTestConnection("pathao")}
                  className="text-xs h-8"
                >
                  {testingId === "pathao" ? (
                    <RotateCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 mr-1" />
                  )}
                  Test Connection
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* EXTENSION ARCHITECTURE NOTICE */}
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/20 flex items-start gap-3">
        <Layers className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Modular Courier Architecture (Extensibility Ready)
          </h5>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The courier integration follows an isolated, provider-agnostic interface (<code>ICourierProvider</code>). When adding future couriers (such as Steadfast, RedX, Paperfly, or DHL), they can be registered in <code>CourierProviderRegistry</code> without modifying checkout, cart, or order database schemas.
          </p>
        </div>
      </div>
    </div>
  );
};
