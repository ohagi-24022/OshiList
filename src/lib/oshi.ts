import { Goods } from '../types';
import { OshiProfile } from '../store/ProfileContext';

export function isOshiGoods(item: Goods, profile: OshiProfile) {
  const oshiName = profile.oshiName.trim();
  const profileSeriesName = profile.seriesName.trim();
  if (!oshiName) return false;

  const characterMatches = item.characterName.trim() === oshiName;
  if (!characterMatches) return false;

  return !profileSeriesName || item.seriesName.trim() === profileSeriesName;
}
