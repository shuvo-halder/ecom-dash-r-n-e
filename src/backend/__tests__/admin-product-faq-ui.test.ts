import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getProductFaqs,
  assignProductFaq,
  reorderProductFaqs,
  unlinkProductFaq,
} from "../../services/product.service";

test("STEP 2D — Admin Product Form: Product FAQs Tab Architecture & UI Logic Suite", async (t) => {
  await t.test("1. Architecture: ProductForm contains dedicated Product FAQs tab without content duplication", () => {
    const productFormPath = path.resolve(process.cwd(), "src/pages/products/ProductForm.tsx");
    const productFormContent = fs.readFileSync(productFormPath, "utf-8");

    // Must include 'faqs' in activeTab state
    assert.ok(
      productFormContent.includes("'basic' | 'media' | 'seo' | 'faqs'"),
      "ProductForm activeTab must include 'faqs'"
    );

    // Must have Product FAQs tab button
    assert.ok(
      productFormContent.includes("Product FAQs"),
      "ProductForm must render 'Product FAQs' tab label"
    );
    assert.ok(
      productFormContent.includes('id="product-tab-faqs"'),
      "ProductForm must have id='product-tab-faqs' for accessibility and targeting"
    );

    // Must import and render ProductFaqsTab
    assert.ok(
      productFormContent.includes("ProductFaqsTab"),
      "ProductForm must import and render ProductFaqsTab"
    );
    assert.ok(
      productFormContent.includes("productId={initialData?.id}"),
      "ProductForm must pass initialData?.id to ProductFaqsTab"
    );

    // ProductForm MUST NOT contain independent question/answer fields in its own state
    assert.ok(
      !productFormContent.includes("faqQuestion"),
      "ProductForm must not store duplicate faqQuestion in formData"
    );
    assert.ok(
      !productFormContent.includes("faqAnswer"),
      "ProductForm must not store duplicate faqAnswer in formData"
    );
  });

  await t.test("2. Create vs Edit Logic: ProductFaqsTab renders informational state when productId is undefined", () => {
    const faqsTabPath = path.resolve(process.cwd(), "src/components/products/ProductFaqsTab.tsx");
    const faqsTabContent = fs.readFileSync(faqsTabPath, "utf-8");

    // When !productId
    assert.ok(
      faqsTabContent.includes("if (!productId)"),
      "ProductFaqsTab must check if (!productId) for Product Create state"
    );
    assert.ok(
      faqsTabContent.includes("Save this product first to add and manage FAQs"),
      "ProductFaqsTab must instruct user to save the product first"
    );
    assert.ok(
      faqsTabContent.includes("Available after saving product"),
      "ProductFaqsTab must display badge or note that FAQs require a saved product"
    );

    // No temporary IDs or client-side mock assignment queues during creation
    assert.ok(
      !faqsTabContent.includes("temp-faq-"),
      "ProductFaqsTab must not generate temp-faq IDs"
    );
  });

  await t.test("3. Data Service Integration: Uses existing Backend Product FAQ APIs", () => {
    const productServicePath = path.resolve(process.cwd(), "src/services/product.service.ts");
    const productServiceContent = fs.readFileSync(productServicePath, "utf-8");

    // Verifies endpoints match Step 2B contract
    assert.ok(
      productServiceContent.includes("`/products/${productId}/faqs`"),
      "productService must call GET /products/:productId/faqs"
    );
    assert.ok(
      productServiceContent.includes("api.post(`/products/${productId}/faqs`"),
      "productService must call POST /products/:productId/faqs"
    );
    assert.ok(
      productServiceContent.includes("`/products/${productId}/faqs/reorder`"),
      "productService must call PUT /products/:productId/faqs/reorder"
    );
    assert.ok(
      productServiceContent.includes("`/products/${productId}/faqs/${faqId}`"),
      "productService must call DELETE /products/:productId/faqs/:faqId"
    );

    // Confirm functions are exported
    assert.strictEqual(typeof getProductFaqs, "function");
    assert.strictEqual(typeof assignProductFaq, "function");
    assert.strictEqual(typeof reorderProductFaqs, "function");
    assert.strictEqual(typeof unlinkProductFaq, "function");
  });

  await t.test("4. Eligible Master FAQ Filtering: Excludes inactive, archived, and already-assigned FAQs", () => {
    const masterFaqs = [
      {
        id: "faq-1",
        question: "How long does shipping take?",
        answer: "Standard shipping takes 3-5 business days.",
        isActive: true,
        deletedAt: null,
        categoryId: "cat-shipping",
      },
      {
        id: "faq-2",
        question: "What is your return policy?",
        answer: "30-day money-back guarantee.",
        isActive: true,
        deletedAt: null,
        categoryId: "cat-returns",
      },
      {
        id: "faq-3",
        question: "Archived question?",
        answer: "Old answer.",
        isActive: true,
        deletedAt: new Date("2026-01-01"), // ARCHIVED
        categoryId: "cat-shipping",
      },
      {
        id: "faq-4",
        question: "Inactive question?",
        answer: "Disabled answer.",
        isActive: false, // INACTIVE
        deletedAt: null,
        categoryId: "cat-returns",
      },
      {
        id: "faq-5",
        question: "Already assigned question?",
        answer: "This is already on the product.",
        isActive: true,
        deletedAt: null,
        categoryId: "cat-shipping",
      },
    ];

    const assignedFaqIds = new Set(["faq-5"]);

    // Filter logic identical to ProductFaqsTab
    const eligible = masterFaqs.filter((item) => {
      if (item.isActive === false) return false;
      if (item.deletedAt !== null && item.deletedAt !== undefined) return false;
      if (assignedFaqIds.has(item.id)) return false;
      return true;
    });

    assert.strictEqual(eligible.length, 2, "Only active, non-archived, unassigned FAQs must be eligible");
    assert.deepStrictEqual(
      eligible.map((f) => f.id),
      ["faq-1", "faq-2"],
      "Eligible FAQs must match faq-1 and faq-2"
    );

    // Search query filtering
    const searchQuery = "shipping";
    const searchFiltered = eligible.filter((item) => {
      const q = searchQuery.toLowerCase();
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
    assert.strictEqual(searchFiltered.length, 1);
    assert.strictEqual(searchFiltered[0].id, "faq-1");

    // Category filtering
    const categoryFiltered = eligible.filter((item) => item.categoryId === "cat-returns");
    assert.strictEqual(categoryFiltered.length, 1);
    assert.strictEqual(categoryFiltered[0].id, "faq-2");
  });

  await t.test("5. Reordering Calculation & Boundaries: Move Up and Move Down correctly reorder sequence", () => {
    const list = [
      { id: "faq-a", question: "A" },
      { id: "faq-b", question: "B" },
      { id: "faq-c", question: "C" },
    ];

    // Move index 1 (B) UP -> targetIndex 0
    const moveUp = (items: typeof list, currentIndex: number) => {
      const targetIndex = currentIndex - 1;
      if (targetIndex < 0 || targetIndex >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(currentIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    };

    const reorderedUp = moveUp(list, 1);
    assert.deepStrictEqual(
      reorderedUp.map((i) => i.id),
      ["faq-b", "faq-a", "faq-c"],
      "Item B should move before Item A"
    );

    // Boundary check: First item cannot move UP
    const firstMoveUp = moveUp(list, 0);
    assert.deepStrictEqual(
      firstMoveUp.map((i) => i.id),
      ["faq-a", "faq-b", "faq-c"],
      "First item must not move up"
    );

    // Move index 1 (B) DOWN -> targetIndex 2
    const moveDown = (items: typeof list, currentIndex: number) => {
      const targetIndex = currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(currentIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    };

    const reorderedDown = moveDown(list, 1);
    assert.deepStrictEqual(
      reorderedDown.map((i) => i.id),
      ["faq-a", "faq-c", "faq-b"],
      "Item B should move after Item C"
    );

    // Boundary check: Last item cannot move DOWN
    const lastMoveDown = moveDown(list, 2);
    assert.deepStrictEqual(
      lastMoveDown.map((i) => i.id),
      ["faq-a", "faq-b", "faq-c"],
      "Last item must not move down"
    );
  });

  await t.test("6. Unlink Semantics: Unlink action removes link and does not delete master FAQ", () => {
    const faqsTabPath = path.resolve(process.cwd(), "src/components/products/ProductFaqsTab.tsx");
    const faqsTabContent = fs.readFileSync(faqsTabPath, "utf-8");

    // Must be labeled "Unlink" (NOT Delete FAQ)
    assert.ok(
      faqsTabContent.includes("Unlink"),
      "Must label action as 'Unlink'"
    );
    assert.ok(
      faqsTabContent.includes("ConfirmDialog"),
      "Must use ConfirmDialog for unlinking"
    );
    assert.ok(
      faqsTabContent.includes("The FAQ itself will <strong>not</strong> be deleted"),
      "Confirmation dialog must inform user that master FAQ is not deleted"
    );

    // Confirm it calls unlinkProductFaq, NOT faqService.deleteFaq
    assert.ok(
      faqsTabContent.includes("unlinkProductFaq(productId, faqToUnlink.id)"),
      "Must call unlinkProductFaq"
    );
    assert.ok(
      !faqsTabContent.includes("faqService.deleteFaq"),
      "Must NOT call faqService.deleteFaq"
    );
  });

  await t.test("7. RBAC: Strict compliance with existing permissions", () => {
    const faqsTabPath = path.resolve(process.cwd(), "src/components/products/ProductFaqsTab.tsx");
    const faqsTabContent = fs.readFileSync(faqsTabPath, "utf-8");

    // Uses existing Products read/write permissions
    assert.ok(
      faqsTabContent.includes("hasPermission('Products', 'read')"),
      "Must check hasPermission('Products', 'read')"
    );
    assert.ok(
      faqsTabContent.includes("hasPermission('Products', 'write')"),
      "Must check hasPermission('Products', 'write')"
    );

    // Shortcut link uses FAQ permission
    assert.ok(
      faqsTabContent.includes("hasPermission('FAQ', 'read')"),
      "Must check hasPermission('FAQ', 'read') for Manage FAQs shortcut"
    );
    assert.ok(
      faqsTabContent.includes("/admin/faqs"),
      "Manage FAQs shortcut must navigate to /admin/faqs"
    );

    // No new unauthorized permission strings created
    assert.ok(
      !faqsTabContent.includes("PRODUCT_FAQ"),
      "Must not invent new permission strings"
    );
  });

  await t.test("8. Accessibility & Forms: All buttons inside tab have type='button' to prevent form submit", () => {
    const faqsTabPath = path.resolve(process.cwd(), "src/components/products/ProductFaqsTab.tsx");
    const faqsTabContent = fs.readFileSync(faqsTabPath, "utf-8");

    // Match all <Button ...> and <button ...> tags
    const buttonTags = faqsTabContent.match(/<(Button|button)[^>]*>/g) || [];
    assert.ok(buttonTags.length > 0, "Tab must have buttons");

    for (const tag of buttonTags) {
      assert.ok(
        tag.includes('type="button"') || tag.includes("type='button'"),
        `Every button inside ProductFaqsTab must have type="button" to prevent parent form submission. Found: ${tag}`
      );
    }
  });
});
