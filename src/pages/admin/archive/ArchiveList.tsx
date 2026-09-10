import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Archive, 
  RotateCcw, 
  Trash2, 
  Search, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  ShieldCheck, 
  Package, 
  Layers, 
  Image, 
  FolderTree, 
  Tag, 
  ShoppingCart, 
  CreditCard, 
  RotateCcw as ReturnIcon, 
  Truck, 
  Ticket, 
  Zap, 
  Megaphone, 
  LayoutTemplate, 
  FileText, 
  PenTool, 
  HelpCircle, 
  Star, 
  Users, 
  Shield, 
  AlertCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  Lock,
  X
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { 
  archiveService, 
  SUPPORTED_ARCHIVE_ENTITIES, 
  SupportedArchiveEntityType, 
  ArchiveListItem, 
  ENTITY_METADATA_MAP, 
  PERMANENTLY_PROTECTED_ENTITIES 
} from "../../../services/archive.service";
import { RestoreConfirmModal } from "./RestoreConfirmModal";
import { HardDeleteSafetyModal } from "./HardDeleteSafetyModal";
import { useAuth } from "../../../context/AuthContext";
import { notify } from "../../../lib/notify";

// Icon mapping helper for all 22 entities
const ENTITY_ICONS: Record<SupportedArchiveEntityType, React.ElementType> = {
  products: Package,
  variants: Layers,
  "product-images": Image,
  categories: FolderTree,
  brands: Tag,
  orders: ShoppingCart,
  payments: CreditCard,
  refunds: RotateCcw,
  returns: ReturnIcon,
  shipments: Truck,
  coupons: Ticket,
  promotions: Zap,
  "marketing-campaigns": Megaphone,
  banners: Image,
  popups: Layers,
  pages: FileText,
  "landing-pages": LayoutTemplate,
  "blog-posts": PenTool,
  faqs: HelpCircle,
  reviews: Star,
  users: Users,
  roles: Shield,
};

const GROUPS = ["All", "Catalog", "Sales & Fulfillment", "Marketing", "Content", "System"] as const;

export function ArchiveList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, can } = useAuth();

  // Read active entity type from URL search params or fallback to 'products'
  const currentEntityTypeParam = searchParams.get("entityType") as SupportedArchiveEntityType;
  const activeEntityType: SupportedArchiveEntityType = 
    SUPPORTED_ARCHIVE_ENTITIES.includes(currentEntityTypeParam)
      ? currentEntityTypeParam
      : "products";

  // Selected Domain Group filter for the entity selector
  const [selectedGroup, setSelectedGroup] = useState<string>("All");

  // Filter and pagination state
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  // Modal interaction states
  const [itemToRestore, setItemToRestore] = useState<ArchiveListItem | null>(null);
  const [itemToHardDelete, setItemToHardDelete] = useState<ArchiveListItem | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle entity change and synchronize URL
  const handleEntityChange = (newEntity: SupportedArchiveEntityType) => {
    setSearchParams({ entityType: newEntity });
    setPage(1);
    setSearchInput("");
    setDebouncedSearch("");
  };

  // Fetch paginated archived records from backend
  const {
    data: archiveResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "archive",
      activeEntityType,
      page,
      limit,
      debouncedSearch,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      archiveService.listArchived(activeEntityType, {
        page,
        limit,
        search: debouncedSearch || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: (item: ArchiveListItem) =>
      archiveService.restoreEntity(activeEntityType, item.id),
    onSuccess: (data, item) => {
      queryClient.invalidateQueries({ queryKey: ["archive", activeEntityType] });
      notify.success("Record Restored", data?.message || `"${item.displayName}" was successfully returned to active records.`);
      setItemToRestore(null);
    },
    onError: (err: any) => {
      notify.apiError(err, "Failed to restore record.");
    },
  });

  const handleConfirmRestore = () => {
    if (itemToRestore) {
      restoreMutation.mutate(itemToRestore);
    }
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const currentMetadata = ENTITY_METADATA_MAP[activeEntityType];
  const CurrentIcon = ENTITY_ICONS[activeEntityType] || Archive;
  const isProtectedEntity = PERMANENTLY_PROTECTED_ENTITIES.includes(activeEntityType);

  // Filter entities according to selected group
  const filteredEntities = useMemo(() => {
    return SUPPORTED_ARCHIVE_ENTITIES.filter((entityKey) => {
      const meta = ENTITY_METADATA_MAP[entityKey];
      if (selectedGroup === "All") return true;
      return meta.group === selectedGroup;
    });
  }, [selectedGroup]);

  const items = archiveResponse?.data || [];
  const pagination = archiveResponse?.pagination;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Archived Records
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Soft-deleted items across the catalog, sales, marketing, and system modules. Safely restore records or execute controlled permanent purges.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Domain Group Filter Selector */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Domain:
          </span>
          {GROUPS.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setSelectedGroup(grp)}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                selectedGroup === grp
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        {/* 22 Entity Tabs / Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {filteredEntities.map((entityKey) => {
            const meta = ENTITY_METADATA_MAP[entityKey];
            const IconComp = ENTITY_ICONS[entityKey] || Archive;
            const isSelected = activeEntityType === entityKey;
            const isProtected = PERMANENTLY_PROTECTED_ENTITIES.includes(entityKey);

            return (
              <button
                key={entityKey}
                type="button"
                onClick={() => handleEntityChange(entityKey)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                  isSelected
                    ? "bg-card border-primary text-primary shadow-sm ring-1 ring-primary/20"
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <IconComp className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span>{meta.label}</span>
                {isProtected && (
                  <span
                    title="Permanently protected from hard deletion (Financial & Legal Retention)"
                    className="inline-flex items-center"
                  >
                    <Lock className="h-3 w-3 text-amber-500 opacity-80" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Card with Filters & Table */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              <CurrentIcon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Archived {currentMetadata.label}
                  {pagination && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {pagination.total} {pagination.total === 1 ? "record" : "records"}
                    </Badge>
                  )}
                  {isProtectedEntity && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                      <Lock className="h-3 w-3" /> Protected from Hard Delete
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isProtectedEntity
                    ? "These records are retained permanently for legal, accounting, and operational compliance."
                    : "Restore records back to the catalog or initiate a controlled hard delete subject to safety checks."}
                </CardDescription>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Server-side Search Input */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={`Search ${currentMetadata.label.toLowerCase()}...`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 text-xs bg-muted/30 p-1 rounded-md border border-border/60">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                <input
                  type="date"
                  aria-label="Archived from date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs text-foreground focus:outline-none px-1"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  aria-label="Archived to date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-xs text-foreground focus:outline-none px-1"
                />
              </div>

              {(searchInput || fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead className="w-[320px]">Record & Identifier</TableHead>
                  <TableHead className="w-[140px]">Entity</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[180px]">Archived Date</TableHead>
                  <TableHead className="w-[180px]">Relations / Counts</TableHead>
                  <TableHead className="w-[200px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading archived records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-destructive text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <span className="font-semibold">Failed to load archived records</span>
                        <span className="text-muted-foreground max-w-md">
                          {(error as any)?.response?.data?.message || (error as any)?.message || "Internal server error"}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 text-xs">
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div className="p-3 rounded-full bg-muted text-muted-foreground">
                          <Archive className="h-6 w-6" />
                        </div>
                        <div className="font-semibold text-foreground text-sm">
                          No archived {currentMetadata.label.toLowerCase()} found
                        </div>
                        <p className="text-muted-foreground max-w-sm text-xs">
                          {debouncedSearch || fromDate || toDate
                            ? "No archived records match the current search or date criteria."
                            : `There are currently no soft-deleted ${currentMetadata.label.toLowerCase()} in the archive repository.`}
                        </p>
                        {(debouncedSearch || fromDate || toDate) && (
                          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-1 text-xs">
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const identifier =
                      item.sku ||
                      item.slug ||
                      item.raw?.orderNumber ||
                      item.raw?.code ||
                      item.raw?.email ||
                      item.raw?.trackingNumber ||
                      item.id;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors text-xs">
                        {/* Name & Primary Identifier */}
                        <TableCell className="font-medium py-3.5">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground text-sm line-clamp-1">
                              {item.displayName}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-muted-foreground">
                                {currentMetadata.primaryIdentifierLabel}:
                              </span>
                              <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border/80 text-foreground">
                                {identifier}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Entity Type Badge */}
                        <TableCell className="py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-muted-foreground capitalize">
                            <CurrentIcon className="h-3 w-3" />
                            {item.entityType}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5">
                          {item.status ? (
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {item.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Archived</span>
                          )}
                        </TableCell>

                        {/* Archived Date */}
                        <TableCell className="py-3.5 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>{new Date(item.deletedAt).toLocaleDateString()}</span>
                            <span className="text-[10px] opacity-75">
                              {new Date(item.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>

                        {/* Relations / Counts */}
                        <TableCell className="py-3.5 text-[11px]">
                          {item.counts && Object.keys(item.counts).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(item.counts).map(([key, count]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-mono text-[10px]"
                                >
                                  {count} {key}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">None</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Safe Restore Action */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setItemToRestore(item)}
                              disabled={restoreMutation.isPending}
                              className="gap-1 text-xs h-7 px-2.5 hover:border-primary hover:text-primary"
                              title="Restore archived record back to active system"
                            >
                              <RotateCcw className="h-3 w-3 text-primary" />
                              Restore
                            </Button>

                            {/* Controlled Hard Delete Action */}
                            {isProtectedEntity ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-1 rounded border border-border/50 cursor-not-allowed"
                                title="Permanently protected from hard deletion (Legal/Financial compliance)"
                              >
                                <Lock className="h-3 w-3 text-amber-500" />
                                Protected
                              </span>
                            ) : !isSuperAdmin ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-1 rounded cursor-not-allowed"
                                title="Permanent hard deletion is restricted to Super Admins only"
                              >
                                <Lock className="h-3 w-3" />
                                SuperAdmin
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setItemToHardDelete(item)}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-7 px-2"
                                title="Permanently purge this record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Hard Delete</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Server-Side Pagination Footer */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-muted/10 text-xs">
              <div className="text-muted-foreground">
                Showing {(page - 1) * limit + 1} to{" "}
                {Math.min(page * limit, pagination.total)} of {pagination.total} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1 text-xs h-7"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <span className="font-medium px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="gap-1 text-xs h-7"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Modal */}
      <RestoreConfirmModal
        isOpen={Boolean(itemToRestore)}
        onOpenChange={(open) => !open && setItemToRestore(null)}
        entityType={activeEntityType}
        item={itemToRestore}
        isLoading={restoreMutation.isPending}
        onConfirm={handleConfirmRestore}
      />

      {/* Hard Delete Safety & Execution Modal */}
      <HardDeleteSafetyModal
        isOpen={Boolean(itemToHardDelete)}
        onOpenChange={(open) => !open && setItemToHardDelete(null)}
        entityType={activeEntityType}
        item={itemToHardDelete}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["archive", activeEntityType] });
          setItemToHardDelete(null);
        }}
      />
    </div>
  );
}
export default ArchiveList;
