"use client";

import { useEffect } from "react";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getPiecesPerCartonValue(rawValue) {
  const match = String(rawValue || "").match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0]);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getCartonsValue(item) {
  const piecesPerCarton = getPiecesPerCartonValue(item.qtyPerCtn);

  if (!piecesPerCarton) {
    return null;
  }

  return Number(item.quantity) / piecesPerCarton;
}

export default function OrderReceiptPrint({
  autoPrint = false,
  order,
}) {
  useEffect(() => {
    if (!autoPrint || order?.status !== "confirmed") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [autoPrint, order?.status]);

  const items = order?.items || [];
  const totalCartons = items.reduce((sum, item) => {
    const cartons = getCartonsValue(item);
    return cartons == null ? sum : sum + cartons;
  }, 0);
  const hasCartonValues = items.some((item) => getCartonsValue(item) != null);
  const totalPieces = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.lineTotalInr || 0),
    0,
  );

  return (
    <>
      <style jsx global>{`
        @page {
          margin: 4mm;
          size: auto;
        }

        body {
          margin: 0;
          background: #f5f5f4;
          color: #111827;
        }

        * {
          box-sizing: border-box;
        }

        @media print {
          body {
            background: #ffffff;
          }

          .receipt-root {
            padding: 0 !important;
          }

          .receipt-no-print {
            display: none !important;
          }

          .receipt-page {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            max-width: none !important;
          }

          .receipt-page,
          .receipt-page * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .receipt-table {
            overflow: visible !important;
          }

          .receipt-table thead {
            display: table-header-group;
          }

          .receipt-table tfoot {
            display: table-row-group;
          }

          .receipt-table tr,
          .receipt-table td,
          .receipt-table th,
          .receipt-table img,
          .receipt-table .receipt-photo-fallback {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <main className="receipt-root" style={{ padding: "24px" }}>
        <div
          className="receipt-page"
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #d6d3d1",
            boxShadow: "0 18px 48px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div
            className="receipt-no-print"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "12px",
              padding: "20px 24px",
              borderBottom: "1px solid #e7e5e4",
              background: "#fafaf9",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f97316" }}>
                Receipt Preview
              </div>
              <div style={{ marginTop: "8px", fontSize: "14px", color: "#57534e" }}>
                Use your browser&apos;s Save as PDF option in the print dialog.
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  border: "none",
                  background: "#111827",
                  color: "#ffffff",
                  padding: "12px 18px",
                  borderRadius: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "#ffffff",
                  color: "#44403c",
                  padding: "12px 18px",
                  borderRadius: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>

          <section style={{ padding: "28px 28px 18px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "18px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "#6b7280",
                  }}
                >
                  Payment Receipt
                </p>
                <h1
                  style={{
                    margin: "10px 0 0",
                    fontSize: "32px",
                    lineHeight: 1.1,
                    color: "#111827",
                  }}
                >
                  {order.orderId}
                </h1>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "14px",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                marginTop: "24px",
              }}
            >
              <div style={{ border: "1px solid #000", padding: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280" }}>
                  Customer Name
                </div>
                <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>
                  {order.customerName}
                </div>
              </div>
              <div style={{ border: "1px solid #000", padding: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280" }}>
                  Customer Phone
                </div>
                <div style={{ marginTop: "8px", fontSize: "16px", color: "#111827" }}>
                  {order.customerPhone || "Not provided"}
                </div>
              </div>
              <div style={{ border: "1px solid #000", padding: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280" }}>
                  Ordered At
                </div>
                <div style={{ marginTop: "8px", fontSize: "16px", color: "#111827" }}>
                  {formatDateTime(order.createdAt)}
                </div>
              </div>
              <div style={{ border: "1px solid #000", padding: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6b7280" }}>
                  Confirmed At
                </div>
                <div style={{ marginTop: "8px", fontSize: "16px", color: "#111827" }}>
                  {formatDateTime(order.confirmedAt || order.createdAt)}
                </div>
              </div>
            </div>

            <div className="receipt-table" style={{ marginTop: "24px", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  border: "1px solid #000",
                }}
              >
                <colgroup>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {[
                      "ITEM NO",
                      "DESCRIPTION",
                      "Photo",
                      "CTNS",
                      "PCS/CTN",
                      "TOTAL PCS",
                      "PRICE/PC",
                      "AMOUNT",
                    ].map((label) => (
                      <th
                        key={label}
                        style={{
                          border: "1px solid #000",
                          padding: "10px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textAlign: "center",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const cartons = getCartonsValue(item);

                    return (
                      <tr
                        key={`${order.orderId}-${item.id}`}
                        style={{
                          breakInside: "avoid",
                          pageBreakInside: "avoid",
                        }}
                      >
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            textAlign: "center",
                            verticalAlign: "middle",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.productCode}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            verticalAlign: "middle",
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{item.productName}</div>
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "8px",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              style={{
                                width: "52px",
                                height: "52px",
                                objectFit: "contain",
                                display: "inline-block",
                              }}
                            />
                          ) : (
                            <div
                              className="receipt-photo-fallback"
                              style={{
                                width: "52px",
                                height: "52px",
                                margin: "0 auto",
                                border: "1px dashed #9ca3af",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                color: "#6b7280",
                              }}
                            >
                              No Photo
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          {cartons == null ? "-" : formatNumber(cartons)}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          {item.qtyPerCtn || "-"}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          {formatNumber(item.quantity)}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            textAlign: "right",
                            verticalAlign: "middle",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(item.unitPriceInr)}
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "10px 8px",
                            fontSize: "13px",
                            textAlign: "right",
                            verticalAlign: "middle",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(item.lineTotalInr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f5f5f5" }}>
                    <td
                      colSpan={3}
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "right",
                      }}
                    >
                      TOTAL
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      {hasCartonValues ? formatNumber(totalCartons) : "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      -
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      {formatNumber(totalPieces)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      -
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCurrency(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
