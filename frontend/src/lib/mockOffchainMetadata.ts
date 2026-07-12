/**
 * Simulated "off-chain metadata" store, standing in for the
 * PostgreSQL-backed metadata service described in the TruePrice
 * proposal (e.g. product images, store location, customer reviews).
 * This project doesn't run an actual database, so this module
 * deterministically derives realistic-looking mock metadata purely
 * from the product's on-chain id, so that the same product always
 * "resolves" to the same simulated off-chain record — demonstrating
 * how a real deployment would aggregate off-chain metadata together
 * with on-chain blockchain state on the `/verify/[id]` page.
 */

export interface OffchainProductMetadata {
  storeName: string;
  storeLocation: string;
  imageEmoji: string;
  averageRating: number;
  reviewCount: number;
  lastSyncedAt: string;
}

const STORE_NAMES = [
  'Marketplace Central',
  'Urban Goods Co.',
  'Nova Retail Hub',
  'GreenLeaf Traders',
  'Pinnacle Supply',
  'Everstock Emporium',
];

const STORE_LOCATIONS = [
  'Kuala Lumpur, MY',
  'Singapore, SG',
  'Taipei, TW',
  'Bangkok, TH',
  'Jakarta, ID',
  'Manila, PH',
];

const PRODUCT_EMOJIS = [
  '📦',
  '🛍️',
  '🧴',
  '🎧',
  '👟',
  '⌚',
  '🖥️',
  '📱',
  '🧢',
  '☕',
];

/** Simple deterministic pseudo-random number generator seeded by a number. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

/**
 * Deterministically derives simulated off-chain metadata for a given
 * product id. The same id always yields the same metadata, mimicking
 * a stable row lookup in an off-chain database.
 */
export function getMockOffchainMetadata(
  productId: bigint,
): OffchainProductMetadata {
  const seed = Number(productId % BigInt(100000)) || 1;

  const storeName =
    STORE_NAMES[Math.floor(seededRandom(seed) * STORE_NAMES.length)];
  const storeLocation =
    STORE_LOCATIONS[
      Math.floor(seededRandom(seed + 1) * STORE_LOCATIONS.length)
    ];
  const imageEmoji =
    PRODUCT_EMOJIS[Math.floor(seededRandom(seed + 2) * PRODUCT_EMOJIS.length)];
  const averageRating = Math.round((3 + seededRandom(seed + 3) * 2) * 10) / 10;
  const reviewCount = Math.floor(5 + seededRandom(seed + 4) * 495);

  return {
    storeName,
    storeLocation,
    imageEmoji,
    averageRating,
    reviewCount,
    lastSyncedAt: new Date().toLocaleString(),
  };
}
