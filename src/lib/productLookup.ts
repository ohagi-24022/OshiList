import { PhotoInferResult, ProductLookupResult, ProductSearchCandidate, ReceiptParseResult } from '../types';

type LookupApiResponse = Partial<{
  janCode: string;
  boxName: string;
  productName: string;
  imageUrl: string | null;
  image_url: string | null;
  sourceLabel: string;
  source: string;
  warnings: string[];
  confidence: number | null;
  sourceUrls: string[];
  source_urls: string[];
  lineup: Array<Partial<{ characterName: string; character_name: string; variantName: string; variant_name: string }>>;
  variants: Array<Partial<{ characterName: string; character_name: string; variantName: string; variant_name: string }>>;
}>;

type ProductCandidateApiResponse = Partial<{
  boxName: string;
  box_name: string;
  imageUrl: string | null;
  image_url: string | null;
  sourceLabel: string;
  source_label: string;
}>;

type ReceiptApiResponse = Partial<{
  items: Array<
    Partial<{
      rawText: string;
      raw_text: string;
      normalizedQuery: string;
      normalized_query: string;
      confidence: number;
      candidates: ProductCandidateApiResponse[];
    }>
  >;
  warnings: string[];
}>;

type PhotoInferApiResponse = Partial<{
  boxName: string;
  box_name: string;
  seriesName: string;
  series_name: string;
  characterName: string;
  character_name: string;
  goodsType: string;
  goods_type: string;
  variantName: string;
  variant_name: string;
  isRandom: boolean;
  is_random: boolean;
  confidence: number;
  warnings: string[];
}>;

const LOOKUP_API_URL = process.env.EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL;
const DEFAULT_TIMEOUT_MS = 30000;
const LOOKUP_TIMEOUT_MS = 90000;
const RECEIPT_TIMEOUT_MS = 60000;

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return '商品検索APIから情報を取得できませんでした。手動登録に切り替えてください。';
}

function apiBaseUrl() {
  if (!LOOKUP_API_URL) {
    throw new Error('商品検索APIが未設定です。手動登録に切り替えてください。');
  }
  return LOOKUP_API_URL.replace(/\/lookup(?:\?.*)?$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('通信がタイムアウトしました。時間をおいて再度お試しください。');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupProductByJan(janCode: string): Promise<ProductLookupResult> {
  const normalizedJan = janCode.trim();
  if (!/^\d{8,14}$/.test(normalizedJan)) {
    throw new Error('JANコードは8から14桁の数字で入力してください。');
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('オフラインのため商品情報を取得できません。手動登録に切り替えてください。');
  }

  const response = await fetchWithTimeout(`${apiBaseUrl()}/lookup?jan=${encodeURIComponent(normalizedJan)}`, {}, LOOKUP_TIMEOUT_MS);
  const payload = (await response.json().catch(() => null)) as LookupApiResponse | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  const variants = payload?.lineup ?? payload?.variants ?? [];
  const boxName = payload?.boxName ?? payload?.productName;

  if (!boxName) {
    throw new Error('このJANコードに一致する商品が見つかりませんでした。手動登録に切り替えてください。');
  }

  return {
    janCode: payload?.janCode ?? normalizedJan,
    boxName,
    imageUrl: payload?.imageUrl ?? payload?.image_url ?? null,
    sourceLabel: payload?.sourceLabel ?? payload?.source ?? '商品検索API',
    warnings: payload?.warnings ?? [],
    confidence: payload?.confidence ?? null,
    sourceUrls: payload?.sourceUrls ?? payload?.source_urls ?? [],
    lineup: variants
      .map((variant) => ({
        characterName: variant.characterName ?? variant.character_name ?? '',
        variantName: variant.variantName ?? variant.variant_name ?? '通常版',
      }))
      .filter((variant) => variant.characterName.trim().length > 0),
  };
}

export async function parseReceiptImage(imageBase64: string, mimeType = 'image/jpeg'): Promise<ReceiptParseResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('オフラインのため領収書を解析できません。手動登録に切り替えてください。');
  }

  const response = await fetchWithTimeout(
    `${apiBaseUrl()}/receipt/parse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    },
    RECEIPT_TIMEOUT_MS,
  );
  const payload = (await response.json().catch(() => null)) as ReceiptApiResponse | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return {
    warnings: payload?.warnings ?? [],
    items: (payload?.items ?? [])
      .map((item) => ({
        rawText: item.rawText ?? item.raw_text ?? '',
        normalizedQuery: item.normalizedQuery ?? item.normalized_query ?? '',
        confidence: Number(item.confidence ?? 0),
        candidates: (item.candidates ?? [])
          .map((candidate) => ({
            boxName: candidate.boxName ?? candidate.box_name ?? '',
            imageUrl: candidate.imageUrl ?? candidate.image_url ?? null,
            sourceLabel: candidate.sourceLabel ?? candidate.source_label ?? '商品検索API',
          }))
          .filter((candidate) => candidate.boxName.trim().length > 0),
      }))
      .filter((item) => item.normalizedQuery.trim().length > 0),
  };
}

export async function inferGoodsFromPhoto(imageBase64: string, mimeType = 'image/jpeg'): Promise<PhotoInferResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('オフラインのため写真から推定できません。手動登録に切り替えてください。');
  }

  const response = await fetchWithTimeout(
    `${apiBaseUrl()}/photo/infer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    },
    RECEIPT_TIMEOUT_MS,
  );
  const payload = (await response.json().catch(() => null)) as PhotoInferApiResponse | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return {
    boxName: payload?.boxName ?? payload?.box_name ?? '',
    seriesName: payload?.seriesName ?? payload?.series_name ?? '',
    characterName: payload?.characterName ?? payload?.character_name ?? '',
    goodsType: payload?.goodsType ?? payload?.goods_type ?? '',
    variantName: payload?.variantName ?? payload?.variant_name ?? '',
    isRandom: Boolean(payload?.isRandom ?? payload?.is_random ?? false),
    confidence: Number(payload?.confidence ?? 0),
    warnings: payload?.warnings ?? [],
  };
}

export async function searchProductsByName(query: string, limit = 5): Promise<ProductSearchCandidate[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('オフラインのため画像候補を取得できません。');
  }

  const response = await fetchWithTimeout(`${apiBaseUrl()}/search?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`);
  const payload = (await response.json().catch(() => null)) as ProductCandidateApiResponse[] | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (Array.isArray(payload) ? payload : [])
    .map((candidate) => ({
      boxName: candidate.boxName ?? candidate.box_name ?? '',
      imageUrl: candidate.imageUrl ?? candidate.image_url ?? null,
      sourceLabel: candidate.sourceLabel ?? candidate.source_label ?? '商品検索API',
    }))
    .filter((candidate) => candidate.boxName.trim().length > 0);
}
