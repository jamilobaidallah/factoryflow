/**
 * Generate unique production order number
 */
export const generateOrderNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `PROD-${year}${month}${day}-${random}`;
};

/**
 * Format dimensions for display
 */
export const formatDimensions = (
  thickness?: number,
  width?: number,
  length?: number
): string | null => {
  if (!thickness) return null;
  return `${thickness}سم × ${width || "-"}سم × ${length || "-"}سم`;
};

/**
 * Get status badge class
 */
export const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "مكتمل":
      return "bg-green-100 text-green-700";
    case "قيد التنفيذ":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-red-100 text-red-700";
  }
};
