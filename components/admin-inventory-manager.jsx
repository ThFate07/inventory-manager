"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CatalogMaker from "../catalog_maker";

const CATALOG_SOURCE_STORAGE_KEY = "admin-catalog-source";

const NAV_ITEMS = [
  { id: "overview", label: "Dashboard" },
  { id: "orders", label: "Orders" },
  { id: "history", label: "History" },
  { id: "logs", label: "Logs" },
  { id: "catalog", label: "Catalog" },
  { id: "imports", label: "Import" },
];

function emptyFormState() {
  return {
    id: "",
    code: "",
    name: "",
    category: "",
    ctn: "",
    qtyPerCtn: "",
    catalogUnit: "1 pcs",
    stockQuantity: "",
    unitPriceInr: "",
    imageUrl: "",
    imageFile: null,
    imageFileName: "",
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeCodeKey(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function normalizeImportHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeItemCode(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function fileNameToCodeKey(fileName) {
  const withoutExtension = String(fileName || "").replace(/\.[^.]+$/, "").trim();
  const withoutIndexSuffix = withoutExtension.replace(/\s*\(\d+\)\s*$/, "").trim();
  return normalizeCodeKey(withoutIndexSuffix || withoutExtension);
}

function readCatalogSourceFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(CATALOG_SOURCE_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function writeCatalogSourceToStorage(value) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.sessionStorage.removeItem(CATALOG_SOURCE_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CATALOG_SOURCE_STORAGE_KEY, JSON.stringify(value));
}

function getImportedImageUrl(item) {
  return normalizeImportedCell(
    item["IMAGE URL"] ||
      item["IMAGE"] ||
      item["IMG"] ||
      item.imageUrl ||
      item.image ||
      item.ImageUrl ||
      item.Image ||
      "",
  );
}

function buildWorkbookCatalogProducts(rows, imageDataByCode = new Map()) {
  return rows.map((item, index) => {
    const code = getImportedItemCode(item) || `ROW-${index + 1}`;
    const normalizedCodeKey = normalizeCodeKey(code);

    return {
      id: index + 1,
      code,
      name: getImportedItemName(item) || "Unnamed Product",
      category: item.category || item.Category || "General",
      ctn: item.CTN || item.ctn || item.Ctn || "",
      qtyPerCtn: item["QTY/CTN"] || item.qtyPerCtn || item.QtyPerCtn || item.qtyPerCTN || "",
      catalogUnit:
        item.FOR ||
        item.for ||
        item.For ||
        item.catalogUnit ||
        item.CatalogUnit ||
        item.catalogQtyLabel ||
        item.CatalogQtyLabel ||
        item.qtyLabel ||
        item.QtyLabel ||
        item.pack ||
        item.Pack ||
        "1 pcs",
      stockQuantity: Number(
        item["TOTAL QTY"] ||
          item.totalQty ||
          item.TotalQty ||
          item.stockQuantity ||
          item.stock ||
          item.StockQuantity ||
          item.Stock ||
          0,
      ),
      unitPriceInr: Number(item["UNIT PRICE"] || item.unitPriceInr || item.price || item.Price || 0),
      imageUrl: imageDataByCode.get(normalizedCodeKey) || getImportedImageUrl(item) || "",
    };
  });
}

function buildCatalogCategories(products) {
  const categoryMap = new Map();

  for (const product of products) {
    const name = String(product.category || "General").trim() || "General";
    const key = normalizeCodeKey(name);

    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        id: key || name,
        name,
      });
    }
  }

  return Array.from(categoryMap.values());
}

async function parseJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { error: responseText };
  }
}

async function uploadImageFile(file, { productCode = "" } = {}) {
  if (!file) {
    throw new Error("Select an image file to upload.");
  }

  const formData = new FormData();
  formData.append("file", file);

  if (productCode) {
    formData.append("productCode", productCode);
  }

  const response = await fetch("/api/admin/uploads/product-image", {
    method: "POST",
    body: formData,
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok || !payload.url) {
    throw new Error(payload.error || `Could not upload ${file.name}.`);
  }

  return payload.url;
}

function getImportedItemCode(item) {
  return normalizeItemCode(
    item["ITEM NO"] ||
      item["ITEM NUMBER"] ||
      item.itemNo ||
      item.itemNumber ||
      item.ItemNo ||
      item.ItemNumber ||
      item.code ||
      item.Code ||
      "",
  );
}

function getImportedItemName(item) {
  return normalizeImportedCell(
    item.DESCRIPTION ||
      item["ITEM NAME"] ||
      item.description ||
      item.Description ||
      item.itemName ||
      item.ItemName ||
      item.name ||
      item.Name ||
      "",
  );
}

function isImportableWorksheetRow(row) {
  const itemCode = getImportedItemCode(row);
  const itemName = getImportedItemName(row);
  const price = normalizeImportedCell(row["UNIT PRICE"] || row.unitPriceInr || row.price || row.Price || "");
  const totalQty = normalizeImportedCell(
    row["TOTAL QTY"] ||
      row.totalQty ||
      row.TotalQty ||
      row.stockQuantity ||
      row.stock ||
      row.StockQuantity ||
      row.Stock ||
      "",
  );

  return Boolean(itemCode && (itemName || price || totalQty));
}

function normalizeImportedCell(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function readWorksheetRows(XLSX, worksheet) {
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const headerRowIndex = matrix.findIndex((row) => {
    if (!Array.isArray(row)) {
      return false;
    }

    const normalizedHeaders = row.map((cell) => normalizeImportHeader(cell));
    return (
      normalizedHeaders.includes("ITEM NO") ||
      normalizedHeaders.includes("ITEM NUMBER") ||
      normalizedHeaders.includes("DESCRIPTION")
    );
  });

  if (headerRowIndex === -1) {
    throw new Error(
      "Could not find a header row. Include columns like ITEM NO, DESCRIPTION, TOTAL QTY, and UNIT PRICE.",
    );
  }

  const headers = matrix[headerRowIndex].map((cell, index) => {
    const label = normalizeImportHeader(cell);
    return label || `COLUMN_${index + 1}`;
  });

  return matrix
    .slice(headerRowIndex + 1)
    .filter(
      (row) =>
        Array.isArray(row) && row.some((cell) => normalizeImportedCell(cell) !== ""),
    )
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    )
    .filter((row) => isImportableWorksheetRow(row));
}

function getImportErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallbackMessage;
}

function getJsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function chunkProductsForImport(products, basePayload, maxBytes = 3_500_000) {
  const chunks = [];
  let currentChunk = [];

  for (const product of products) {
    const nextChunk = [...currentChunk, product];
    const nextPayload = {
      ...basePayload,
      products: nextChunk,
    };

    if (currentChunk.length > 0 && getJsonByteLength(nextPayload) > maxBytes) {
      chunks.push(currentChunk);
      currentChunk = [product];
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function StatusPill({ children, tone = "neutral" }) {
  const toneClassName =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-stone-200 text-stone-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${toneClassName}`}>
      {children}
    </span>
  );
}

function getLogTone(action) {
  if (action === "product_deleted" || action === "import_image_unmatched_product") {
    return "warning";
  }

  if (
    action === "stock_deducted_from_order" ||
    action === "order_confirmed" ||
    action === "orders_cleared" ||
    action === "import_image_unmatched_file" ||
    action === "products_cleared"
  ) {
    return "warning";
  }

  if (action === "product_updated" || action === "product_imported") {
    return "neutral";
  }

  return "success";
}

function getLogLabel(action) {
  const labels = {
    product_created: "Created",
    product_updated: "Updated",
    product_deleted: "Deleted",
    product_imported: "Imported",
    product_created_from_import: "Imported New",
    import_image_unmatched_product: "Missing Image",
    import_image_unmatched_file: "Unused Image",
    products_cleared: "Cleared All",
    orders_cleared: "Orders Cleared",
    stock_deducted_from_order: "Stock Deducted",
    order_confirmed: "Order Confirmed",
    inventory_import_summary: "Import Summary",
  };

  return labels[action] || action;
}

function getLogType(action) {
  if (
    action === "product_imported" ||
    action === "product_created_from_import" ||
    action === "inventory_import_summary" ||
    action === "import_image_unmatched_product" ||
    action === "import_image_unmatched_file"
  ) {
    return "import";
  }

  if (action === "products_cleared") {
    return "product";
  }

  if (
    action === "stock_deducted_from_order" ||
    action === "order_confirmed" ||
    action === "orders_cleared"
  ) {
    return "order";
  }

  if (
    action === "product_created" ||
    action === "product_updated" ||
    action === "product_deleted"
  ) {
    return "product";
  }

  return "other";
}

function getLogTypeLabel(type) {
  const labels = {
    all: "All Logs",
    import: "Import Logs",
    order: "Order Logs",
    product: "Product Logs",
    other: "Other Logs",
  };

  return labels[type] || type;
}

function RecentOrdersPanel({ orders = [], expanded = false }) {
  const [openOrderIds, setOpenOrderIds] = useState(() => new Set());

  function toggleOrder(orderId) {
    setOpenOrderIds((current) => {
      const next = new Set(current);

      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }

      return next;
    });
  }

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
            Order History
          </p>
          <h3 className="mt-2 text-2xl font-bold text-stone-900">Recent orders</h3>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
          {orders.length}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5 text-sm text-stone-500">
            No customer orders have been placed yet.
          </div>
        ) : (
          orders.map((order) => (
            <article
              key={order.orderId}
              className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">
                    {order.orderId}
                  </p>
                  <h4 className="mt-1 text-lg font-bold text-stone-900">
                    {order.customerName}
                  </h4>
                  <p className="mt-1 text-sm text-stone-500">
                    {order.itemCount} items, {order.totalQuantity} units
                  </p>
                </div>
                <StatusPill tone={order.status === "confirmed" ? "success" : "warning"}>
                  {order.status}
                </StatusPill>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
                <span>{formatDateTime(order.createdAt)}</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(order.totalAmountInr)}
                </span>
              </div>

              {expanded ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => toggleOrder(order.orderId)}
                    className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    {openOrderIds.has(order.orderId) ? "Hide Details" : "View Details"}
                  </button>

                  {openOrderIds.has(order.orderId) ? (
                    <div className="mt-4 space-y-4 rounded-[1.5rem] border border-stone-200 bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                            Customer Phone
                          </p>
                          <p className="mt-1 text-sm text-stone-700">
                            {order.customerPhone || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                            Payment Status
                          </p>
                          <p className="mt-1 text-sm text-stone-700">{order.paymentStatus}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                            Ordered At
                          </p>
                          <p className="mt-1 text-sm text-stone-700">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                            Confirmed At
                          </p>
                          <p className="mt-1 text-sm text-stone-700">
                            {order.confirmedAt ? formatDateTime(order.confirmedAt) : "Not confirmed yet"}
                          </p>
                        </div>
                      </div>

                      {order.notes ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                            Notes
                          </p>
                          <p className="mt-1 text-sm leading-6 text-stone-700">{order.notes}</p>
                        </div>
                      ) : null}

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                          Items Ordered
                        </p>
                        <div className="mt-3 space-y-3">
                          {order.items.map((item) => (
                            <div
                              key={`${order.orderId}-${item.productId}`}
                              className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3"
                            >
                              <div>
                                <p className="font-semibold text-stone-900">{item.productName}</p>
                                <p className="text-sm text-stone-500">{item.productCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-stone-500">Qty {item.quantity}</p>
                                <p className="font-semibold text-stone-900">
                                  {formatCurrency(item.lineTotalInr)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function InventoryLogPanel({ logs = [] }) {
  const [selectedType, setSelectedType] = useState("all");

  const filteredLogs = useMemo(() => {
    if (selectedType === "all") {
      return logs;
    }

    return logs.filter((log) => getLogType(log.action) === selectedType);
  }, [logs, selectedType]);

  const availableTypes = useMemo(() => {
    const types = new Set(logs.map((log) => getLogType(log.action)));
    return ["all", ...Array.from(types)];
  }, [logs]);

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
            Inventory Logs
          </p>
          <h3 className="mt-2 text-2xl font-bold text-stone-900">Recent activity</h3>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
          {filteredLogs.length}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Log Type
          </span>
          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {getLogTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5 text-sm text-stone-500">
            No inventory logs match the selected type.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <article
              key={log.id}
              className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={getLogTone(log.action)}>
                      {getLogLabel(log.action)}
                    </StatusPill>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
                      {getLogTypeLabel(getLogType(log.action))}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                      {log.productCode || "Inventory"}
                    </span>
                  </div>
                  <h4 className="mt-3 text-lg font-bold text-stone-900">
                    {log.productName || "Inventory record"}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{log.details}</p>
                </div>
                <span className="shrink-0 text-xs text-stone-400">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ProductModal({
  form,
  saving,
  error,
  onClose,
  onChange,
  onImageFileChange,
  onSubmit,
  title,
}) {
  const fields = [
    { key: "name", label: "Product Name", type: "text", placeholder: "Product Name" },
    { key: "code", label: "Item No", type: "text", placeholder: "Item No" },
    { key: "category", label: "Category", type: "text", placeholder: "Category" },
    { key: "ctn", label: "CTN", type: "text", placeholder: "CTN" },
    { key: "qtyPerCtn", label: "QTY/CTN", type: "text", placeholder: "QTY/CTN" },
    {
      key: "catalogUnit",
      label: "FOR",
      type: "text",
      placeholder: "1 pcs",
    },
    {
      key: "unitPriceInr",
      label: "Price in INR",
      type: "number",
      min: "0",
      step: "0.01",
      placeholder: "Price in INR",
    },
    {
      key: "stockQuantity",
      label: "Stock Quantity",
      type: "number",
      min: "0",
      step: "1",
      placeholder: "Stock Quantity",
    },
    { key: "imageUrl", label: "Image URL", type: "text", placeholder: "Image URL", required: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-8 text-gray-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
              Inventory Editor
            </p>
            <h2 className="mt-2 text-3xl font-bold">{title}</h2>
            <p className="mt-2 text-gray-500">
              Update product details in a focused modal instead of editing inline on the dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">
                {field.label}
              </span>
              <input
                type={field.type}
                min={field.min}
                step={field.step}
                value={form[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                className="w-full rounded-2xl border border-stone-200 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder={field.placeholder}
                required={field.required !== false}
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">
              Upload Image
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onImageFileChange(event.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-stone-200 px-5 py-4 text-gray-900 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:font-semibold file:text-orange-700"
            />
            <p className="mt-2 text-xs text-gray-500">
              {form.imageFileName
                ? `Selected file: ${form.imageFileName}. This file will be used when you save.`
                : "You can keep using an image URL or upload a replacement image file here."}
            </p>
          </label>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-green-500 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {saving ? "Saving..." : form.id ? "Update Product" : "Create Product"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminInventoryManager({
  initialProducts = [],
  initialCategories = [],
  initialRecentOrders = [],
  initialInventoryLogs = [],
  adminDisplayName = "Admin",
  initialSection = "overview",
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [recentOrders, setRecentOrders] = useState(initialRecentOrders);
  const [inventoryLogs, setInventoryLogs] = useState(initialInventoryLogs);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [activeSection, setActiveSection] = useState(initialSection);
  const [form, setForm] = useState(emptyFormState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [orderLookupId, setOrderLookupId] = useState("");
  const [orderLookupError, setOrderLookupError] = useState("");
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [loadedOrder, setLoadedOrder] = useState(null);
  const [importWorkflow, setImportWorkflow] = useState("inventory");
  const [importFile, setImportFile] = useState(null);
  const [importImageFiles, setImportImageFiles] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isClearingProducts, setIsClearingProducts] = useState(false);
  const [isClearingOrders, setIsClearingOrders] = useState(false);
  const [catalogSourceProducts, setCatalogSourceProducts] = useState(
    () => readCatalogSourceFromStorage()?.products || [],
  );
  const [catalogSourceCategories, setCatalogSourceCategories] = useState(
    () => readCatalogSourceFromStorage()?.categories || [],
  );
  const [catalogSourceTitle, setCatalogSourceTitle] = useState(
    () => readCatalogSourceFromStorage()?.title || "Crockery Product Catalog",
  );

  useEffect(() => {
    if (catalogSourceProducts.length === 0) {
      writeCatalogSourceToStorage(null);
      return;
    }

    writeCatalogSourceToStorage({
      products: catalogSourceProducts,
      categories: catalogSourceCategories,
      title: catalogSourceTitle,
    });
  }, [catalogSourceCategories, catalogSourceProducts, catalogSourceTitle]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All Categories" ||
        product.category === selectedCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  const dashboardStats = useMemo(() => {
    const lowStockCount = products.filter((product) => product.stockQuantity <= 20).length;
    const inventoryValue = products.reduce(
      (total, product) => total + product.stockQuantity * product.unitPriceInr,
      0,
    );

    return {
      lowStockCount,
      inventoryValue,
    };
  }, [products]);

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stockQuantity <= 20).slice(0, 5),
    [products],
  );

  function getNavMeta(itemId) {
    if (itemId === "orders") {
      return "live";
    }

    if (itemId === "history") {
      return "past";
    }

    if (itemId === "logs") {
      return "log";
    }

    if (itemId === "catalog") {
      return "pdf";
    }

    if (itemId === "imports") {
      return "xls";
    }

    return "home";
  }

  async function refreshDashboard() {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Unable to refresh admin dashboard.");
    }

    const payload = await response.json();
    setProducts(payload.products || []);
    setCategories(payload.categories || []);
    setRecentOrders(payload.recentOrders || []);
    setInventoryLogs(payload.inventoryLogs || []);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "code" ? normalizeItemCode(value) : value,
    }));
  }

  function openCreateModal() {
    setForm(emptyFormState());
    setError("");
    setIsProductModalOpen(true);
  }

  function beginEdit(product) {
    setForm({
      id: String(product.id),
      code: product.code,
      name: product.name,
      category: product.category,
      ctn: product.ctn || "",
      qtyPerCtn: product.qtyPerCtn || "",
      catalogUnit: product.catalogUnit || "1 pcs",
      stockQuantity: String(product.stockQuantity),
      unitPriceInr: String(product.unitPriceInr),
      imageUrl: product.imageUrl,
      imageFile: null,
      imageFileName: "",
    });
    setError("");
    setIsProductModalOpen(true);
  }

  function closeModal() {
    setIsProductModalOpen(false);
    setForm(emptyFormState());
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        code: form.code,
        name: form.name,
        category: form.category,
        ctn: form.ctn,
        qtyPerCtn: form.qtyPerCtn,
        catalogUnit: form.catalogUnit,
        stockQuantity: Number(form.stockQuantity),
        unitPriceInr: Number(form.unitPriceInr),
        imageUrl: form.imageFile
          ? await uploadImageFile(form.imageFile, { productCode: form.code })
          : form.imageUrl,
      };
      const response = await fetch(
        form.id ? `/api/admin/products/${form.id}` : "/api/admin/products",
        {
          method: form.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const responseBody = await response.json();

      if (!response.ok) {
        setError(responseBody.error || "Could not save product.");
        return;
      }

      closeModal();
      await refreshDashboard();
    } catch (caughtError) {
      setError(getImportErrorMessage(caughtError, "Could not save product."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId) {
    setError("");

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not delete product.");
        return;
      }

      await refreshDashboard();
    } catch {
      setError("Could not delete product.");
    }
  }

  function handleImportFileSelected(event) {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
    setError("");
    setImportStatus("");
  }

  async function handleExcelUpload() {
    if (importWorkflow === "catalog" && !importFile) {
      setError("Select an Excel file before generating the catalog.");
      return;
    }

    if (!importFile && importImageFiles.length === 0) {
      setError(
        importWorkflow === "catalog"
          ? "Select an Excel file or at least one image before generating the catalog."
          : "Select an Excel file or at least one image before starting the import.",
      );
      return;
    }

    setIsImporting(true);
    setError("");
    setImportStatus("");

    try {
      let rows = [];

      if (importFile) {
        const XLSX = await import("xlsx");
        const data = await importFile.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(data), { type: "array" });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          throw new Error("The selected workbook does not contain any sheets.");
        }

        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          throw new Error(`Could not open sheet "${sheetName}".`);
        }

        rows = readWorksheetRows(XLSX, worksheet);

        if (rows.length === 0) {
          setError(
            "No product rows were found in the selected sheet. Check that ITEM NO, DESCRIPTION, TOTAL QTY, and UNIT PRICE contain values.",
          );
          return;
        }
      }

      const imageFilesByCode = new Map();
      for (const imageFile of importImageFiles) {
        const codeKey = fileNameToCodeKey(imageFile.name);
        if (!codeKey) {
          continue;
        }

        const currentGroup = imageFilesByCode.get(codeKey) || [];
        currentGroup.push(imageFile);
        imageFilesByCode.set(codeKey, currentGroup);
      }

      const importSourceRows =
        rows.length > 0
          ? rows
          : importWorkflow === "catalog"
            ? []
            : products.map((product) => ({
              id: product.id,
              "ITEM NO": product.code,
              DESCRIPTION: product.name,
              Category: product.category,
              CTN: product.ctn,
              "QTY/CTN": product.qtyPerCtn,
              FOR: product.catalogUnit,
              Stock: product.stockQuantity,
              "UNIT PRICE": product.unitPriceInr,
              Image: product.imageUrl,
            }));

      const matchedFilesByCode = new Map();
      for (const [codeKey, groupedFiles] of imageFilesByCode.entries()) {
        if (groupedFiles?.length) {
          matchedFilesByCode.set(codeKey, groupedFiles[groupedFiles.length - 1]);
        }
      }

      const matchedRowCodes = new Set();
      for (const item of importSourceRows) {
        const codeKey = normalizeCodeKey(getImportedItemCode(item));
        if (codeKey && matchedFilesByCode.has(codeKey)) {
          matchedRowCodes.add(codeKey);
        }
      }

      if (matchedFilesByCode.size > 0) {
        setImportStatus(
          `Uploading ${matchedFilesByCode.size} matched image${matchedFilesByCode.size === 1 ? "" : "s"} to cloud storage...`,
        );
      }

      const imageDataByCode = new Map(
        await Promise.all(
          Array.from(matchedFilesByCode.entries()).map(async ([codeKey, matchedFile]) => {
            const uploadedUrl = await uploadImageFile(matchedFile, { productCode: codeKey });
            return [codeKey, uploadedUrl];
          }),
        ),
      );

      if (matchedFilesByCode.size > 0) {
        setImportStatus("Image upload complete. Saving product changes...");
      }

      const unmatchedProducts =
        importImageFiles.length > 0
          ? importSourceRows
              .map((item) => ({
                code: getImportedItemCode(item),
                name: getImportedItemName(item) || "Unnamed Product",
                category: item.category || item.Category || "General",
              }))
              .filter((product) => !matchedRowCodes.has(normalizeCodeKey(product.code)))
          : [];

      const unmatchedImages = Array.from(imageFilesByCode.entries()).flatMap(([codeKey, files]) => {
        if (!matchedRowCodes.has(codeKey)) {
          return files.map((file) => file.name);
        }

        return files.slice(0, -1).map((file) => file.name);
      });

      const normalizedProducts = importSourceRows
        .filter((item) => rows.length > 0 || matchedRowCodes.has(normalizeCodeKey(getImportedItemCode(item))))
        .map((item) => ({
          id: item.id ? Number(item.id) : undefined,
          code: getImportedItemCode(item),
          name: getImportedItemName(item) || "Unnamed Product",
          category: item.category || item.Category || "General",
          ctn: item.CTN || item.ctn || item.Ctn || "",
          qtyPerCtn: item["QTY/CTN"] || item.qtyPerCtn || item.QtyPerCtn || item.qtyPerCTN || "",
          catalogUnit:
            item.FOR ||
            item.for ||
            item.For ||
            item.catalogUnit ||
            item.CatalogUnit ||
            item.catalogQtyLabel ||
            item.CatalogQtyLabel ||
            item.qtyLabel ||
            item.QtyLabel ||
            item.pack ||
            item.Pack ||
            "1 pcs",
          stockQuantity: Number(
            item["TOTAL QTY"] ||
              item.totalQty ||
              item.TotalQty ||
              item.stockQuantity ||
              item.stock ||
              item.StockQuantity ||
              item.Stock ||
              0,
          ),
          unitPriceInr: Number(item["UNIT PRICE"] || item.unitPriceInr || item.price || item.Price || 0),
          imageUrl:
            imageDataByCode.get(normalizeCodeKey(getImportedItemCode(item))) ||
            item.imageUrl ||
            item.image ||
            item.ImageUrl ||
            item.Image ||
            "",
        }));

      if (normalizedProducts.length === 0) {
        setError(
          importWorkflow === "catalog"
            ? "No importable catalog rows were found in the selected sheet."
            : "No products matched the uploaded image names.",
        );
        return;
      }

      if (importWorkflow === "catalog") {
        const catalogProducts = buildWorkbookCatalogProducts(importSourceRows, imageDataByCode);
        const catalogCategories = buildCatalogCategories(catalogProducts);
        const catalogTitleBase = String(importFile?.name || "Imported Catalog").replace(/\.[^.]+$/, "");

        setCatalogSourceProducts(catalogProducts);
        setCatalogSourceCategories(catalogCategories);
        setCatalogSourceTitle(catalogTitleBase || "Imported Catalog");
        setImportStatus(
          `Prepared ${catalogProducts.length} catalog item${catalogProducts.length === 1 ? "" : "s"} from ${importFile?.name || "the selected sheet"}.`,
        );
        setImportFile(null);
        setImportImageFiles([]);
        setActiveSection("catalog");
        return;
      }

      const importMode = importFile ? "sheet" : "images-only";
      const basePayload = {
        importMode,
        unmatchedProducts: [],
        unmatchedImages: [],
        logUnmatched: false,
        logSummary: false,
        returnSnapshot: false,
      };
      const productChunks = chunkProductsForImport(normalizedProducts, basePayload);

      if (productChunks.length === 0) {
        throw new Error("No importable products were prepared.");
      }

      for (const [index, productChunk] of productChunks.entries()) {
        const isFinalChunk = index === productChunks.length - 1;
        const response = await fetch("/api/admin/products/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            products: productChunk,
            unmatchedProducts: isFinalChunk ? unmatchedProducts : [],
            unmatchedImages: isFinalChunk ? unmatchedImages : [],
            importMode,
            logUnmatched: isFinalChunk,
            logSummary: isFinalChunk,
            summaryProductCount: isFinalChunk ? normalizedProducts.length : undefined,
            returnSnapshot: false,
          }),
        });

        const payload = await parseJsonResponse(response);

        if (!response.ok) {
          setError(
            payload.error ||
              `Import failed with status ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
          );
          return;
        }

        if (productChunks.length > 1) {
          setImportStatus(
            `Uploading import batch ${index + 1} of ${productChunks.length}...`,
          );
        }
      }

      await refreshDashboard();
      const unmatchedProductPreview =
        unmatchedProducts.length > 0
          ? ` Unmatched products: ${unmatchedProducts.slice(0, 5).map((product) => product.code).join(", ")}${unmatchedProducts.length > 5 ? ` and ${unmatchedProducts.length - 5} more` : ""}.`
          : "";
      const unmatchedImagePreview =
        unmatchedImages.length > 0
          ? ` Unmatched images: ${unmatchedImages.slice(0, 5).join(", ")}${unmatchedImages.length > 5 ? ` and ${unmatchedImages.length - 5} more` : ""}.`
          : "";
      setImportStatus(
        `${importFile ? `Imported ${normalizedProducts.length} row${normalizedProducts.length === 1 ? "" : "s"}` : `Updated ${normalizedProducts.length} product image${normalizedProducts.length === 1 ? "" : "s"}`} successfully${importImageFiles.length > 0 ? ` with ${matchedRowCodes.size} matched image${matchedRowCodes.size === 1 ? "" : "s"}` : ""}.${unmatchedProductPreview}${unmatchedImagePreview}`,
      );
      setCatalogSourceProducts([]);
      setCatalogSourceCategories([]);
      setCatalogSourceTitle("Crockery Product Catalog");
      setImportFile(null);
      setImportImageFiles([]);
      setActiveSection("imports");
    } catch (error) {
      setError(getImportErrorMessage(error, "Import failed."));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleClearProducts() {
    setError("");
    setImportStatus("");

    if (products.length === 0) {
      setError("There are no products to clear.");
      return;
    }

    const confirmed = window.confirm(
      `This will permanently delete all ${products.length} products from the admin inventory. This cannot be undone. Continue?`,
    );

    if (!confirmed) {
      return;
    }

    const confirmationText = window.prompt(
      'Type CLEAR ALL to permanently delete every product.',
      "",
    );

    if (confirmationText !== "CLEAR ALL") {
      setError("Bulk delete cancelled. Type CLEAR ALL exactly to continue.");
      return;
    }

    setIsClearingProducts(true);

    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not clear products.");
        return;
      }

      setProducts(payload.products || []);
      setCategories(payload.categories || []);
      setImportStatus(
        `Cleared ${payload.deletedCount || 0} product${payload.deletedCount === 1 ? "" : "s"} from inventory.`,
      );
      await refreshDashboard();
    } catch {
      setError("Could not clear products.");
    } finally {
      setIsClearingProducts(false);
    }
  }

  async function handleClearOrders() {
    setError("");
    setImportStatus("");
    setOrderLookupError("");

    if (recentOrders.length === 0) {
      setError("There are no orders to clear.");
      return;
    }

    const confirmed = window.confirm(
      `This will permanently delete all ${recentOrders.length} orders from the admin order history. This cannot be undone. Continue?`,
    );

    if (!confirmed) {
      return;
    }

    const confirmationText = window.prompt(
      "Type CLEAR ORDERS to permanently delete every order.",
      "",
    );

    if (confirmationText !== "CLEAR ORDERS") {
      setError("Bulk order delete cancelled. Type CLEAR ORDERS exactly to continue.");
      return;
    }

    setIsClearingOrders(true);

    try {
      const response = await fetch("/api/admin/orders", {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Could not clear orders.");
        return;
      }

      setRecentOrders(payload.recentOrders || []);
      setInventoryLogs(payload.inventoryLogs || []);
      setLoadedOrder(null);
      setOrderLookupId("");
      setImportStatus(
        `Cleared ${payload.deletedCount || 0} order${payload.deletedCount === 1 ? "" : "s"} from history.`,
      );
      await refreshDashboard();
    } catch {
      setError("Could not clear orders.");
    } finally {
      setIsClearingOrders(false);
    }
  }

  function handleImportImagesSelected(event) {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    setImportImageFiles((current) => {
      const nextByCode = new Map(current.map((file) => [fileNameToCodeKey(file.name), file]));

      for (const file of files) {
        const codeKey = fileNameToCodeKey(file.name);
        if (codeKey) {
          nextByCode.set(codeKey, file);
        }
      }

      return Array.from(nextByCode.values());
    });
    setError("");
    setImportStatus("");
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function fetchOrderDetails() {
    if (!orderLookupId.trim()) {
      setOrderLookupError("Enter an order ID.");
      return;
    }

    setIsLoadingOrder(true);
    setOrderLookupError("");

    try {
      const response = await fetch(`/api/admin/orders/${orderLookupId.trim()}`);
      const payload = await response.json();

      if (!response.ok) {
        setOrderLookupError(payload.error || "Unable to fetch order.");
        setLoadedOrder(null);
        return;
      }

      setLoadedOrder(payload.order);
    } catch {
      setOrderLookupError("Unable to fetch order.");
      setLoadedOrder(null);
    } finally {
      setIsLoadingOrder(false);
    }
  }

  async function confirmLoadedOrder() {
    if (!loadedOrder?.orderId) {
      return;
    }

    setIsConfirmingOrder(true);
    setOrderLookupError("");

    try {
      const response = await fetch(`/api/admin/orders/${loadedOrder.orderId}/confirm`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setOrderLookupError(payload.error || "Unable to confirm order.");
        return;
      }

      setLoadedOrder(payload.order);
      await refreshDashboard();
    } catch {
      setOrderLookupError("Unable to confirm order.");
    } finally {
      setIsConfirmingOrder(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#120d09] text-white">
      <style jsx global>{`
        @media print {
          .admin-print-hidden {
            display: none !important;
          }

          .admin-print-catalog-only {
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>

      <main
        className={`px-5 py-6 md:px-8 md:py-8 ${
          activeSection === "catalog" ? "admin-print-catalog-only" : ""
        }`}
      >
        <header
          className={`mb-8 rounded-[2rem] border border-white/10 bg-[#1a130f]/90 p-4 shadow-2xl backdrop-blur ${
            activeSection === "catalog" ? "admin-print-hidden" : ""
          }`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
                  Admin Panel
                </p>
                <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                  Crockery Desk
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  Manage products, orders, and imports.
                </p>
              </div>

              <nav className="flex flex-wrap gap-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === "overview") {
                        router.push("/admin");
                        return;
                      }

                      if (item.id === "orders") {
                        router.push("/admin/orders");
                        return;
                      }

                      if (item.id === "history") {
                        router.push("/admin/history");
                        return;
                      }

                      if (item.id === "logs") {
                        router.push("/admin/logs");
                        return;
                      }

                      if (item.id === "catalog") {
                        router.push("/admin/catalog");
                        return;
                      }

                      if (item.id === "imports") {
                        router.push("/admin/imports");
                      }
                    }}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeSection === item.id
                        ? "bg-orange-500 text-white shadow-lg"
                        : "border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                      {getNavMeta(item.id)}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {activeSection === "overview" ? (
          <section className="space-y-6">
            <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/55">Products</p>
                <p className="mt-3 text-4xl font-bold">{products.length}</p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/55">Low Stock</p>
                <p className="mt-3 text-4xl font-bold text-amber-300">{dashboardStats.lowStockCount}</p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/55">Categories</p>
                <p className="mt-3 text-4xl font-bold">{categories.length}</p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/55">Inventory Value</p>
                <p className="mt-3 text-3xl font-bold text-emerald-300">
                  {formatCurrency(dashboardStats.inventoryValue)}
                </p>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(260px,0.55fr)]">
              <section className="min-h-[calc(100vh-24rem)] rounded-[2rem] border border-white/10 bg-white p-8 text-gray-900 shadow-2xl">
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                      Inventory Management
                    </p>
                    <h3 className="mt-2 text-3xl font-bold">Product Library</h3>
                    <p className="mt-2 text-gray-500">
                      Showing {filteredProducts.length} products in the current admin view.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="rounded-2xl bg-black px-5 py-3 font-semibold text-white"
                    >
                      Add Product
                    </button>
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search item no or item..."
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 md:w-72"
                    />
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="rounded-2xl border border-stone-200 px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option>All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/history")}
                      className="rounded-2xl border border-stone-200 px-5 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      View Order History
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Products Shown</p>
                    <p className="mt-3 text-3xl font-bold text-stone-900">{filteredProducts.length}</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Low Stock</p>
                    <p className="mt-3 text-3xl font-bold text-amber-600">
                      {filteredProducts.filter((product) => product.stockQuantity <= 20).length}
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Inventory Value</p>
                    <p className="mt-3 text-2xl font-bold text-emerald-600">
                      {formatCurrency(
                        filteredProducts.reduce(
                          (total, product) => total + product.stockQuantity * product.unitPriceInr,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-lg"
                    >
                      {product.imageUrl ? (
                        <div className="flex h-60 w-full items-center justify-center bg-white p-3">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-60 w-full items-center justify-center bg-stone-100 text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
                          No Image
                        </div>
                      )}

                      <div className="space-y-5 p-6">
                        <div className="flex items-start justify-between gap-3">
                          <StatusPill tone={product.stockQuantity <= 20 ? "warning" : "success"}>
                            {product.category}
                          </StatusPill>
                          <span className="text-xs text-gray-500">{product.code}</span>
                        </div>

                        <div>
                          <h4 className="text-xl font-bold">{product.name}</h4>
                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            Stock level is {product.stockQuantity}. Use the edit action below to update
                            pricing, categorization, or imagery.
                          </p>
                          <p className="mt-2 text-sm text-gray-500">
                            {product.qtyPerCtn && product.ctn
                              ? `${product.name}, ${product.qtyPerCtn} In CTN`
                              : product.name}
                            {product.catalogUnit ? `, For ${product.catalogUnit}` : ""}
                          </p>
                          {!product.canDelete ? (
                            <p className="mt-2 text-sm text-amber-600">
                              This product is used in {product.orderReferenceCount} order{product.orderReferenceCount === 1 ? "" : "s"} and cannot be deleted.
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-gray-600">Stock: {product.stockQuantity}</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(product.unitPriceInr)}
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => beginEdit(product)}
                            className="flex-1 rounded-xl bg-orange-500 py-2 font-semibold text-white transition hover:bg-orange-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            disabled={!product.canDelete}
                            className="flex-1 rounded-xl border border-red-300 py-2 font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 disabled:hover:bg-transparent"
                          >
                            {product.canDelete ? "Delete" : "Used In Orders"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="space-y-6 self-start xl:justify-self-end xl:w-full">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
                    Quick Actions
                  </p>
                  <h3 className="mt-2 text-2xl font-bold">Common tasks</h3>
                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="w-full rounded-2xl bg-orange-500 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      Add a product
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/orders")}
                      className="w-full rounded-2xl border border-white/15 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Confirm a customer order
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/history")}
                      className="w-full rounded-2xl border border-white/15 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Browse order history
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/logs")}
                      className="w-full rounded-2xl border border-white/15 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Review inventory logs
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admin/imports")}
                      className="w-full rounded-2xl border border-white/15 px-4 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Import inventory sheet
                    </button>
                    <button
                      type="button"
                      onClick={handleClearProducts}
                      disabled={isClearingProducts || products.length === 0}
                      className="w-full rounded-2xl border border-red-400/60 bg-red-500/15 px-4 py-2.5 text-left text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
                    >
                      {isClearingProducts ? "Clearing products..." : "Clear all products"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearOrders}
                      disabled={isClearingOrders || recentOrders.length === 0}
                      className="w-full rounded-2xl border border-red-400/60 bg-red-500/15 px-4 py-2.5 text-left text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
                    >
                      {isClearingOrders ? "Clearing orders..." : "Clear all orders"}
                    </button>
                    <p className="text-xs leading-5 text-red-100/80">
                      Both destructive actions require two confirmations. Product clearing is blocked while products are tied to existing orders.
                    </p>
                  </div>
                </div>

                <RecentOrdersPanel orders={recentOrders} />
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "orders" ? (
            <section className="rounded-[2rem] border border-white/10 bg-white p-8 text-gray-900 shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Orders
              </p>
              <h3 className="mt-2 text-3xl font-bold">Order Confirmation Desk</h3>
              <p className="mt-2 text-gray-500">
                Paste the order ID shared by the customer, review the pending items, then confirm payment and stock deduction.
              </p>

              <div className="mt-6 flex flex-col gap-3 md:flex-row">
                <input
                  value={orderLookupId}
                  onChange={(event) => setOrderLookupId(event.target.value)}
                  placeholder="Enter Order ID"
                  className="flex-1 rounded-2xl border px-5 py-4"
                />
                <button
                  type="button"
                  onClick={fetchOrderDetails}
                  disabled={isLoadingOrder}
                  className="rounded-2xl bg-black px-6 py-4 font-semibold text-white transition hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {isLoadingOrder ? "Fetching..." : "Fetch Order"}
                </button>
              </div>

              {orderLookupError ? (
                <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {orderLookupError}
                </p>
              ) : null}

              {loadedOrder ? (
                <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                        {loadedOrder.orderId}
                      </p>
                      <h4 className="mt-2 text-2xl font-bold">{loadedOrder.customerName}</h4>
                      <p className="mt-1 text-gray-600">
                        Phone: {loadedOrder.customerPhone || "Not provided"}
                      </p>
                      <p className="mt-1 text-gray-600">
                        Status: {loadedOrder.status} | Payment: {loadedOrder.paymentStatus}
                      </p>
                      {loadedOrder.notes ? (
                        <p className="mt-2 text-gray-600">Notes: {loadedOrder.notes}</p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-500">Order Total</p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatCurrency(loadedOrder.totalAmountInr)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {loadedOrder.items.map((item) => (
                      <div
                        key={`${loadedOrder.orderId}-${item.productId}`}
                        className="flex items-center justify-between rounded-2xl bg-white p-4"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.productCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Qty {item.quantity}</p>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(item.lineTotalInr)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={confirmLoadedOrder}
                    disabled={isConfirmingOrder || loadedOrder.status === "confirmed"}
                    className="mt-6 rounded-2xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                  >
                    {loadedOrder.status === "confirmed"
                      ? "Order Already Confirmed"
                      : isConfirmingOrder
                        ? "Confirming..."
                        : "Confirm Order and Payment"}
                  </button>
                </div>
              ) : null}
            </section>
        ) : null}

        {activeSection === "history" ? (
            <section className="rounded-[2rem] border border-white/10 bg-white p-8 text-gray-900 shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Order History
              </p>
              <h3 className="mt-2 text-3xl font-bold">Expanded order timeline</h3>
              <p className="mt-2 text-gray-500">
                Review previously placed customer orders, totals, quantities, and confirmation status in one place.
              </p>

              <div className="mt-8">
                <RecentOrdersPanel orders={recentOrders} expanded />
              </div>
            </section>
        ) : null}

        {activeSection === "logs" ? (
            <section className="rounded-[2rem] border border-white/10 bg-white p-8 text-gray-900 shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Inventory Logs
              </p>
              <h3 className="mt-2 text-3xl font-bold">Activity ledger</h3>
              <p className="mt-2 text-gray-500">
                Track product creation, edits, imports, deletions, and stock deductions from confirmed orders.
              </p>

              <div className="mt-8">
                <InventoryLogPanel logs={inventoryLogs} />
              </div>
            </section>
        ) : null}

        {activeSection === "imports" ? (
            <section className="rounded-[2rem] border border-white/10 bg-white p-8 text-gray-900 shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Imports
              </p>
              <h3 className="mt-2 text-3xl font-bold">
                {importWorkflow === "catalog" ? "Excel Catalog Builder" : "Excel Inventory Import"}
              </h3>
              <p className="mt-2 text-gray-500">
                {importWorkflow === "catalog"
                  ? "Import a sheet to build a printable catalog from Excel without changing inventory."
                  : "Import a sheet when you want to bulk refresh inventory, or upload images alone to remap product photos by item number."}
              </p>

              <div className="mt-6 inline-flex rounded-2xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setImportWorkflow("inventory");
                    setImportStatus("");
                    setError("");
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    importWorkflow === "inventory"
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  Inventory Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportWorkflow("catalog");
                    setImportStatus("");
                    setError("");
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    importWorkflow === "catalog"
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  Catalog from Excel
                </button>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-dashed border-orange-200 bg-orange-50 p-6">
                <p className="font-semibold text-gray-900">
                  {importWorkflow === "catalog"
                    ? "Upload Excel Catalog File"
                    : "Upload Excel Inventory File"}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFileSelected}
                  className="mt-4 block w-full text-sm"
                />
                <p className="mt-2 text-sm text-gray-500">
                  {importFile
                    ? `Selected sheet: ${importFile.name}`
                    : importWorkflow === "catalog"
                      ? "Choose a sheet, then generate a catalog preview without importing products into inventory."
                      : "Choose a sheet, or skip it and upload only images. Import starts only when you click the button below."}
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block rounded-[1.25rem] border border-orange-200 bg-white p-4">
                    <span className="text-sm font-semibold text-gray-900">Optional image folder</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      webkitdirectory=""
                      directory=""
                      onChange={handleImportImagesSelected}
                      className="mt-3 block w-full text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Pick a folder when image files are named with the item number.
                    </p>
                  </label>

                  <label className="block rounded-[1.25rem] border border-orange-200 bg-white p-4">
                    <span className="text-sm font-semibold text-gray-900">Optional image files</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImportImagesSelected}
                      className="mt-3 block w-full text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      You can also select individual images instead of a full folder.
                    </p>
                  </label>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Supported columns: ITEM NO, DESCRIPTION, CTN, QTY/CTN, UNIT PRICE, FOR,
                  Category, Stock, and Image. If you upload images separately, the importer
                  matches them to rows using the file name as the item number.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  If multiple products share the same ITEM NO, one matching image file will be
                  reused for all of those variants. This is useful when one product photo shows
                  multiple related items together.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {importImageFiles.length > 0
                    ? `${importImageFiles.length} image file${importImageFiles.length === 1 ? "" : "s"} staged for item-number matching.`
                    : importWorkflow === "catalog"
                      ? "No separate images selected. You can still generate the catalog from text and pricing columns alone."
                      : "No separate images selected. You can import just images later to replace existing product photos by item number."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleExcelUpload}
                    disabled={
                      (importWorkflow === "catalog"
                        ? !importFile
                        : !importFile && importImageFiles.length === 0) ||
                      isImporting
                    }
                    className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                  >
                    {isImporting
                      ? importWorkflow === "catalog"
                        ? "Generating..."
                        : "Importing..."
                      : importWorkflow === "catalog"
                        ? "Generate Catalog"
                        : "Start Import"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportImageFiles([]);
                      setImportStatus("");
                      setError("");
                    }}
                    disabled={isImporting}
                    className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear Selection
                  </button>
                </div>
                {importStatus ? (
                  <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {importStatus}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}
              </div>
            </section>
        ) : null}

        {activeSection === "catalog" ? (
          <CatalogMaker
            products={catalogSourceProducts.length > 0 ? catalogSourceProducts : products}
            categories={catalogSourceProducts.length > 0 ? catalogSourceCategories : categories}
            initialTitle={
              catalogSourceProducts.length > 0 ? catalogSourceTitle : "Crockery Product Catalog"
            }
            sourceLabel={
              catalogSourceProducts.length > 0 ? "Imported Excel Rows" : "Database Products"
            }
          />
        ) : null}
      </main>

      {isProductModalOpen ? (
        <ProductModal
          form={form}
          saving={saving}
          error={error}
          onClose={closeModal}
          onChange={updateForm}
          onImageFileChange={(file) =>
            setForm((current) => ({
              ...current,
              imageFile: file,
              imageFileName: file?.name || "",
            }))
          }
          onSubmit={handleSubmit}
          title={form.id ? "Edit Inventory Item" : "Create Inventory Item"}
        />
      ) : null}
    </div>
  );
}
