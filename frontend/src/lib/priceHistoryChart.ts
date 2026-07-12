/**
 * Utility functions for rendering a lightweight, dependency-free SVG
 * line chart of a product's chronological price history. No chart
 * library is installed for this — the geometry is derived manually
 * so this stays fully type-safe and has zero extra runtime cost.
 */

// (BigInt literals such as `0n` require ES2020+; this project targets
// ES2017, so `BigInt(0)` is used instead wherever a bigint literal
// value is needed across the frontend.)

export interface ChartPoint {
  x: number;
  y: number;
  price: number;
  timestamp: number;
}

export interface PriceChartGeometry {
  /** SVG "points" attribute value for a <polyline>, e.g. "0,10 20,5 40,15". */
  polylinePoints: string;
  /** SVG path `d` attribute for a filled area under the line (same shape, closed to the baseline). */
  areaPath: string;
  /** Each data point mapped to pixel coordinates, plus its original price/timestamp for tooltips/labels. */
  points: ChartPoint[];
  /** The minimum price in the series (used for the Y-axis label). */
  minPrice: number;
  /** The maximum price in the series (used for the Y-axis label). */
  maxPrice: number;
}

/**
 * Converts a chronological list of (price, timestamp) pairs into pixel
 * coordinates for an SVG line/area chart within the given viewbox
 * dimensions, with padding on all sides to leave room for point
 * markers.
 */
export function buildPriceChartGeometry(
  history: { price: number; timestamp: number }[],
  width: number,
  height: number,
  padding = 8,
): PriceChartGeometry {
  if (history.length === 0) {
    return {
      polylinePoints: '',
      areaPath: '',
      points: [],
      minPrice: 0,
      maxPrice: 0,
    };
  }

  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  // Avoid a zero-height range (flat price history) collapsing the chart.
  const priceRange = maxPrice - minPrice || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points: ChartPoint[] = history.map((entry, i) => {
    const x =
      history.length === 1
        ? padding + innerWidth / 2
        : padding + (i / (history.length - 1)) * innerWidth;
    const y =
      padding +
      innerHeight -
      ((entry.price - minPrice) / priceRange) * innerHeight;
    return { x, y, price: entry.price, timestamp: entry.timestamp };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const baseline = height - padding;
  const areaPath =
    points.length > 0
      ? `M ${points[0].x},${baseline} ` +
        points.map((p) => `L ${p.x},${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x},${baseline} Z`
      : '';

  return { polylinePoints, areaPath, points, minPrice, maxPrice };
}

/** Formats a Unix timestamp (seconds) as a short date, e.g. "Jan 5, 2025". */
export function formatShortDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
