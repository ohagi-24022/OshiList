import { ProductLookupResult } from '../types';

type LookupApiResponse = Partial<{
  janCode: string;
  boxName: string;
  productName: string;
  imageUrl: string | null;
  image_url: string | null;
  sourceLabel: string;
  source: string;
  warnings: string[];
  lineup: Array<Partial<{ characterName: string; character_name: string; variantName: string; variant_name: string }>>;
  variants: Array<Partial<{ characterName: string; character_name: string; variantName: string; variant_name: string }>>;
}>;

const LOOKUP_API_URL = process.env.EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL;

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return '商品検索APIから情報を取得できませんでした。手動登録に切り替えてください。';
}

export async function lookupProductByJan(janCode: string): Promise<ProductLookupResult> {
  const normalizedJan = janCode.trim();
  if (!/^\d{8,14}$/.test(normalizedJan)) {
    throw new Error('JANコードは8〜14桁の数字で入力してください。');
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('オフラインのため商品情報を取得できません。手動登録に切り替えてください。');
  }

  if (!LOOKUP_API_URL) {
    throw new Error(
      '商品検索APIが未設定です。誤った候補を出さないため、JANコードだけ保持して手動登録に切り替えます。',
    );
  }

  const response = await fetch(`${LOOKUP_API_URL}?jan=${encodeURIComponent(normalizedJan)}`);
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
    lineup: variants
      .map((variant) => ({
        characterName: variant.characterName ?? variant.character_name ?? '',
        variantName: variant.variantName ?? variant.variant_name ?? '通常版',
      }))
      .filter((variant) => variant.characterName.trim().length > 0),
  };
}
