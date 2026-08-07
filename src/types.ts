export type GoodsStatus = 'owned' | 'reserved' | 'ordered' | 'shipped' | 'arrived' | 'wanted' | 'unorganized';

export type Goods = {
  id: number;
  janCode: string | null;
  boxName: string;
  seriesName: string;
  characterName: string;
  variantName: string;
  quantity: number;
  imageUrl: string | null;
  isRandom: boolean;
  status: GoodsStatus;
  targetQuantity: number;
  keepQuantity: number;
  inUseQuantity: number;
  exchangeQuantity: number;
  storageLocation: string;
  usageLocation: string;
  collectionGoal: string;
  releaseDate: string;
  reservationDeadline: string;
  pickupDate: string;
  tags: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoodsInput = {
  janCode?: string | null;
  boxName: string;
  seriesName?: string;
  characterName: string;
  variantName: string;
  quantity?: number;
  imageUrl?: string | null;
  isRandom?: boolean;
  status?: GoodsStatus;
  targetQuantity?: number;
  keepQuantity?: number;
  inUseQuantity?: number;
  exchangeQuantity?: number;
  storageLocation?: string;
  usageLocation?: string;
  collectionGoal?: string;
  releaseDate?: string;
  reservationDeadline?: string;
  pickupDate?: string;
  tags?: string;
  favorite?: boolean;
};

export type ProductLookupResult = {
  janCode: string | null;
  boxName: string;
  imageUrl: string | null;
  sourceLabel: string;
  warnings?: string[];
  lineup: Array<{
    characterName: string;
    variantName: string;
  }>;
};

export type ProductSearchCandidate = {
  boxName: string;
  imageUrl: string | null;
  sourceLabel: string;
};

export type ReceiptItemCandidate = {
  rawText: string;
  normalizedQuery: string;
  confidence: number;
  candidates: ProductSearchCandidate[];
};

export type ReceiptParseResult = {
  items: ReceiptItemCandidate[];
  warnings?: string[];
};

export type PhotoInferResult = {
  boxName: string;
  seriesName: string;
  characterName: string;
  goodsType: string;
  variantName: string;
  isRandom: boolean;
  confidence: number;
  warnings?: string[];
};
