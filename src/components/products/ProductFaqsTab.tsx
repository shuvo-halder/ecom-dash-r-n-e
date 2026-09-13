import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  Link2Off,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Layers,
  Info,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { notify } from '@/src/lib/notify';
import {
  getProductFaqs,
  assignProductFaq,
  reorderProductFaqs,
  unlinkProductFaq,
  ProductFaqItem,
} from '@/src/services/product.service';
import { faqService } from '@/src/services/faq.service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { ConfirmDialog } from '@/src/components/common/ConfirmDialog';

interface ProductFaqsTabProps {
  productId?: string;
}

// Utility to safely extract plain text preview from rich HTML answers
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

export function ProductFaqsTab({ productId }: ProductFaqsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  // RBAC permissions based strictly on existing permissions
  const canReadProducts = hasPermission('Products', 'read');
  const canWriteProducts = hasPermission('Products', 'write');
  const canReadFaqs = hasPermission('FAQ', 'read') || hasPermission('FAQ', 'write');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Action states
  const [assigningFaqId, setAssigningFaqId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [faqToUnlink, setFaqToUnlink] = useState<ProductFaqItem | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // 1. Fetch assigned FAQs for this product
  const {
    data: assignedFaqs = [],
    isLoading: isLoadingAssigned,
    isError: isAssignedError,
    refetch: refetchAssigned,
  } = useQuery<ProductFaqItem[]>({
    queryKey: ['product-faqs', productId],
    queryFn: () => getProductFaqs(productId!),
    enabled: !!productId && canReadProducts,
  });

  // 2. Fetch master FAQs from the central FAQ module (for searching/assigning)
  const {
    data: masterFaqs = [],
    isLoading: isLoadingMaster,
  } = useQuery<any[]>({
    queryKey: ['faq-list'],
    queryFn: faqService.getFaqs,
    enabled: !!productId && canWriteProducts,
  });

  // 3. Fetch FAQ categories (for category filtering in search)
  const { data: faqCategories = [] } = useQuery<any[]>({
    queryKey: ['faq-categories'],
    queryFn: faqService.getCategories,
    enabled: !!productId && canWriteProducts,
  });

  // Set of assigned FAQ IDs for fast exclusion
  const assignedFaqIdSet = useMemo(() => {
    return new Set(assignedFaqs.map((item) => item.id));
  }, [assignedFaqs]);

  // Master FAQs that are active, not archived, and not already assigned
  const eligibleMasterFaqs = useMemo(() => {
    return (masterFaqs || []).filter((item: any) => {
      // Must be active
      if (item.isActive === false) return false;
      // Must not be archived/deleted
      if (item.deletedAt !== null && item.deletedAt !== undefined) return false;
      // Must not already be assigned to this product
      if (assignedFaqIdSet.has(item.id)) return false;
      return true;
    });
  }, [masterFaqs, assignedFaqIdSet]);

  // Filtered search results based on query and category filter
  const filteredSearchResults = useMemo(() => {
    let list = eligibleMasterFaqs;

    // Filter by category
    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (item: any) =>
          item.categoryId === selectedCategory || item.category?.id === selectedCategory
      );
    }

    // Filter by question / answer text
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((item: any) => {
        const questionMatch = item.question?.toLowerCase().includes(query);
        const answerMatch =
          typeof item.answer === 'string' && item.answer.toLowerCase().includes(query);
        return questionMatch || answerMatch;
      });
    }

    return list;
  }, [eligibleMasterFaqs, selectedCategory, searchQuery]);

  // Handle Assign FAQ
  const handleAssignFaq = async (faq: any) => {
    if (!productId || !canWriteProducts || assigningFaqId) return;

    setAssigningFaqId(faq.id);
    try {
      await assignProductFaq(productId, faq.id);
      notify.success('FAQ Assigned', `"${faq.question}" was linked to this product.`);
      queryClient.invalidateQueries({ queryKey: ['product-faqs', productId] });
    } catch (error: any) {
      notify.apiError(error, 'Failed to assign FAQ to this product.');
      refetchAssigned();
    } finally {
      setAssigningFaqId(null);
    }
  };

  // Handle Move Up / Move Down Reordering
  const handleMove = async (currentIndex: number, direction: 'up' | 'down') => {
    if (!productId || !canWriteProducts || isReordering) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= assignedFaqs.length) return;

    const previousOrder = [...assignedFaqs];
    const newOrder = [...assignedFaqs];
    const [movedItem] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, movedItem);

    // Optimistic cache update for instant responsiveness
    queryClient.setQueryData(['product-faqs', productId], newOrder);
    setIsReordering(true);

    try {
      const orderedIds = newOrder.map((f) => f.id);
      await reorderProductFaqs(productId, orderedIds);
      notify.success('Order Updated', 'Product FAQ display order updated.');
      queryClient.invalidateQueries({ queryKey: ['product-faqs', productId] });
    } catch (error: any) {
      // Revert optimistic change on failure
      queryClient.setQueryData(['product-faqs', productId], previousOrder);
      notify.apiError(error, 'Failed to update FAQ order. Restored previous order.');
      refetchAssigned();
    } finally {
      setIsReordering(false);
    }
  };

  // Handle Confirm Unlink
  const handleConfirmUnlink = async () => {
    if (!productId || !faqToUnlink || !canWriteProducts || isUnlinking) return;

    setIsUnlinking(true);
    try {
      await unlinkProductFaq(productId, faqToUnlink.id);
      notify.success('FAQ Unlinked', `"${faqToUnlink.question}" was unlinked from this product.`);
      queryClient.invalidateQueries({ queryKey: ['product-faqs', productId] });
      setFaqToUnlink(null);
    } catch (error: any) {
      notify.apiError(error, 'Failed to unlink FAQ from this product.');
    } finally {
      setIsUnlinking(false);
    }
  };

  // =========================================================================
  // 1. PRODUCT CREATE STATE: Product is not yet saved (no productId)
  // =========================================================================
  if (!productId) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center pb-3 pt-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <HelpCircle className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Product FAQs</CardTitle>
          <CardDescription className="text-base text-muted-foreground max-w-md mx-auto mt-2 leading-relaxed">
            Save this product first to add and manage FAQs.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-8 pt-2 space-y-4">
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Product FAQs link existing questions and answers from your master FAQ library directly to
            this product. Once created, you will be able to search, assign, and arrange their display
            sequence.
          </p>
          <div className="flex justify-center items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 text-xs text-muted-foreground font-medium">
              Available after saving product
            </Badge>
            {canReadFaqs && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/faqs')}
                className="text-xs text-primary hover:text-primary flex items-center gap-1"
              >
                View FAQ Library
                <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // 2. RBAC: User lacks read permissions on Products
  // =========================================================================
  if (!canReadProducts) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            You do not have permission to view FAQs for this product.
          </p>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // 3. PRODUCT EDIT STATE: Complete Management Interface
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Tab Header & FAQ Master Library Shortcut */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Product FAQs
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign relevant questions from the FAQ master library and set their storefront display order.
          </p>
        </div>

        {canReadFaqs && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/faqs')}
            className="self-start sm:self-auto shrink-0 flex items-center gap-1.5 text-xs font-medium"
            id="btn-manage-faqs-shortcut"
          >
            Manage FAQs
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Read-Only Notice if user has read but not write */}
      {!canWriteProducts && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            You have view-only access to products. You cannot assign, reorder, or unlink FAQs.
          </span>
        </div>
      )}

      {/* SECTION 1: Assign FAQ from Master Library (Write-only) */}
      {canWriteProducts && (
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Assign FAQ from Library
            </CardTitle>
            <CardDescription className="text-xs">
              Search active questions from the central FAQ library to attach to this product.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search and Category Filter Inputs */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search active FAQs by question or answer keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 text-sm"
                  id="product-faq-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {faqCategories.length > 0 && (
                <div className="sm:w-56 shrink-0">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    id="product-faq-category-filter"
                    aria-label="Filter FAQs by Category"
                  >
                    <option value="ALL">All Categories ({eligibleMasterFaqs.length})</option>
                    {faqCategories.map((cat: any) => {
                      const count = eligibleMasterFaqs.filter(
                        (f: any) => f.categoryId === cat.id || f.category?.id === cat.id
                      ).length;
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Search Results Display Area */}
            {isLoadingMaster ? (
              <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading FAQ library...
              </div>
            ) : eligibleMasterFaqs.length === 0 ? (
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <p className="text-xs text-muted-foreground">
                  {masterFaqs.length === 0
                    ? 'No FAQs exist in the central library yet.'
                    : 'All active FAQs in the library are already assigned to this product.'}
                </p>
              </div>
            ) : filteredSearchResults.length === 0 ? (
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <p className="text-xs text-muted-foreground">
                  No active unassigned FAQs match your search query "{searchQuery}".
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="text-xs text-muted-foreground font-medium px-1 flex justify-between">
                  <span>Available to Assign ({filteredSearchResults.length})</span>
                  {selectedCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className="text-primary hover:underline text-xs"
                    >
                      Show all categories
                    </button>
                  )}
                </div>

                <div className="divide-y divide-border/60 border border-border/80 rounded-lg overflow-hidden bg-card">
                  {filteredSearchResults.map((faq: any) => {
                    const isAssigning = assigningFaqId === faq.id;
                    const plainAnswer = stripHtml(faq.answer || '');

                    return (
                      <div
                        key={faq.id}
                        className="p-3 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                        id={`master-faq-item-${faq.id}`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground leading-snug">
                              {faq.question}
                            </span>
                            {faq.category?.name && (
                              <Badge variant="secondary" className="text-[11px] py-0 px-2 font-normal">
                                {faq.category.name}
                              </Badge>
                            )}
                          </div>
                          {plainAnswer && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {plainAnswer}
                            </p>
                          )}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isAssigning || !!assigningFaqId}
                          onClick={() => handleAssignFaq(faq)}
                          className="shrink-0 text-xs font-semibold h-8 px-3 hover:bg-primary hover:text-primary-foreground transition-colors"
                          id={`btn-assign-faq-${faq.id}`}
                          aria-label={`Assign FAQ: ${faq.question}`}
                        >
                          {isAssigning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              Assigning...
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Assigned FAQs List & Ordering */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Assigned FAQs
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                {assignedFaqs.length}
              </Badge>
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            These questions will display in this exact sequence on the storefront product page. Use Move Up and Move Down to arrange the order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAssigned ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading assigned product FAQs...</span>
            </div>
          ) : isAssignedError ? (
            <div className="p-6 rounded-lg border border-destructive/20 bg-destructive/5 text-center space-y-3">
              <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">
                Failed to load assigned FAQs for this product.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchAssigned()}
                className="text-xs"
              >
                Retry
              </Button>
            </div>
          ) : assignedFaqs.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20 space-y-2">
              <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">No FAQs assigned yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {canWriteProducts
                  ? 'Search and assign relevant questions from your master library above to display on this product.'
                  : 'No FAQs have been assigned to this product.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {assignedFaqs.map((faq, index) => {
                const plainAnswer = stripHtml(faq.answer || '');
                const isFirst = index === 0;
                const isLast = index === assignedFaqs.length - 1;

                return (
                  <div
                    key={faq.id}
                    className="p-3.5 rounded-lg border border-border/80 bg-card hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    id={`assigned-faq-row-${faq.id}`}
                  >
                    {/* Item Information */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {faq.question}
                          </span>
                          {faq.category?.name && (
                            <Badge variant="secondary" className="text-[11px] py-0 px-2 font-normal">
                              {faq.category.name}
                            </Badge>
                          )}
                          {!faq.isActive && (
                            <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                              Inactive in Library
                            </Badge>
                          )}
                        </div>
                        {plainAnswer && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {plainAnswer}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Controls (Ordering & Unlink) */}
                    {canWriteProducts && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 w-full sm:w-auto justify-end">
                        {/* Move Up */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={isFirst || isReordering}
                          onClick={() => handleMove(index, 'up')}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={isFirst ? 'Already at top' : 'Move Up'}
                          aria-label={`Move ${faq.question} up`}
                          id={`btn-move-up-${faq.id}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>

                        {/* Move Down */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={isLast || isReordering}
                          onClick={() => handleMove(index, 'down')}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={isLast ? 'Already at bottom' : 'Move Down'}
                          aria-label={`Move ${faq.question} down`}
                          id={`btn-move-down-${faq.id}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>

                        {/* Unlink Action */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUnlinking || isReordering}
                          onClick={() => setFaqToUnlink(faq)}
                          className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 ml-1"
                          title="Unlink FAQ from this product"
                          aria-label={`Unlink FAQ: ${faq.question}`}
                          id={`btn-unlink-${faq.id}`}
                        >
                          <Link2Off className="h-3.5 w-3.5 mr-1" />
                          Unlink
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Unlinking */}
      <ConfirmDialog
        isOpen={!!faqToUnlink}
        onOpenChange={(open) => {
          if (!open && !isUnlinking) {
            setFaqToUnlink(null);
          }
        }}
        title="Remove FAQ from this product?"
        description={
          <span className="space-y-2 block">
            <span>
              Are you sure you want to unlink <strong>"{faqToUnlink?.question}"</strong> from this product?
            </span>
            <span className="block text-xs text-muted-foreground">
              The FAQ itself will <strong>not</strong> be deleted. It will remain available in the master FAQ library and can be assigned to other products.
            </span>
          </span>
        }
        confirmText="Unlink"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isUnlinking}
        onConfirm={handleConfirmUnlink}
        onCancel={() => setFaqToUnlink(null)}
      />
    </div>
  );
}
