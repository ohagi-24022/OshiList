import { GoodsStatus } from '../types';

export const goodsStatusLabels: Record<GoodsStatus, string> = {
  owned: '所持',
  reserved: '予約済み',
  ordered: '発送済み',
  shipped: '到着待ち',
  arrived: '到着',
  wanted: '欲しい',
  unorganized: '未整理',
};
