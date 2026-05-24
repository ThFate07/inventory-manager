export function getPiecesPerCartonValue(rawValue) {
  const match = String(rawValue || "").match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0]);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function getPricingUnitLabel(productName = "") {
  return /\bset\b/i.test(String(productName || "")) ? "SET" : "PCS";
}

export function getCartonQuantityFromPieces(quantity, qtyPerCtn) {
  const piecesPerCarton = getPiecesPerCartonValue(qtyPerCtn) || 1;
  return Number(quantity || 0) / piecesPerCarton;
}

export function getCartonPrice(unitPriceInr, qtyPerCtn) {
  const piecesPerCarton = getPiecesPerCartonValue(qtyPerCtn) || 1;
  return Number(unitPriceInr || 0) * piecesPerCarton;
}

export function getMaxCartonQuantity(stockQuantity, qtyPerCtn) {
  const piecesPerCarton = getPiecesPerCartonValue(qtyPerCtn) || 1;
  const stock = Number(stockQuantity || 0);

  if (stock <= 0) {
    return 0;
  }

  return Math.floor(stock / piecesPerCarton);
}

export function getStoredCartonQuantity(item) {
  if (Number.isFinite(Number(item?.cartonQuantity)) && Number(item.cartonQuantity) > 0) {
    return Number(item.cartonQuantity);
  }

  return getCartonQuantityFromPieces(item?.quantity, item?.qtyPerCtn);
}
