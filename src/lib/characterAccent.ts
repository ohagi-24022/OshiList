import { AppColors } from '../store/ThemeContext';
import { Goods } from '../types';

export function getCharacterAccentColor(item: Goods, colors: AppColors) {
  if (!colors.custom) return null;

  const seriesName = item.seriesName.trim();
  const characterName = item.characterName.trim();
  const accent = (colors.characterAccents ?? []).find(
    (candidate) => candidate.seriesName.trim() === seriesName && candidate.characterName.trim() === characterName,
  );

  return accent?.color ?? null;
}
