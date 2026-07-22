export type GoodsStatus = 'owned' | 'reserved' | 'wanted';

export type Goods = {
  id: number;
  janCode: string | null;
  boxName: string;
  characterName: string;
  variantName: string;
  quantity: number;
  imageUrl: string | null;
  status: GoodsStatus;
  createdAt: string;
  updatedAt: string;
};

export type GoodsInput = {
  janCode?: string | null;
  boxName: string;
  characterName: string;
  variantName: string;
  quantity?: number;
  imageUrl?: string | null;
  status?: GoodsStatus;
};

export type ProductLookupResult = {
  janCode: string;
  boxName: string;
  imageUrl: string | null;
  sourceLabel: string;
  warnings?: string[];
  lineup: Array<{
    characterName: string;
    variantName: string;
  }>;
};
