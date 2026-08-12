const randomGoodsKeywords = [
  'random',
  'blind',
  'trading',
  'mystery',
  'gacha',
  'capsule',
  'ランダム',
  'ブラインド',
  'トレーディング',
  'ガチャ',
  'くじ',
  '全種',
];

export function inferIsRandomGoods(productName: string, lineupCount = 0) {
  const normalizedName = productName.toLowerCase();
  return (
    lineupCount > 0 ||
    randomGoodsKeywords.some((keyword) => normalizedName.includes(keyword.toLowerCase())) ||
    /全\s*\d+\s*種/.test(productName) ||
    /\d+\s*種\s*(ランダム|ブラインド|トレーディング)/.test(productName)
  );
}
