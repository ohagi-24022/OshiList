import * as SQLite from 'expo-sqlite';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Goods, GoodsInput, GoodsStatus } from '../types';
import { deleteManagedLocalImage } from '../lib/localImage';

type GoodsContextValue = {
  goods: Goods[];
  loading: boolean;
  addGoods: (input: GoodsInput) => Promise<void>;
  updateGoods: (id: number, input: GoodsInput) => Promise<void>;
  bulkUpdateGoods: (ids: number[], patch: Partial<Pick<GoodsInput, 'seriesName' | 'characterName'>>) => Promise<void>;
  updateQuantity: (id: number, delta: number) => Promise<void>;
  removeGoods: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const GoodsContext = createContext<GoodsContextValue | null>(null);

const db = SQLite.openDatabaseSync('oshilist.db');

function normalizedGoodsInput(input: GoodsInput) {
  return {
    janCode: input.janCode?.trim() || null,
    boxName: input.boxName.trim(),
    seriesName: input.seriesName?.trim() || 'シリーズ未設定',
    characterName: input.characterName.trim() || '未分類',
    variantName: input.variantName.trim() || '通常版',
    quantity: Math.max(0, input.quantity ?? 1),
    imageUrl: input.imageUrl ?? null,
    status: input.status ?? 'owned',
  };
}

function mapGoods(row: Record<string, unknown>): Goods {
  return {
    id: Number(row.id),
    janCode: (row.jan_code as string | null) ?? null,
    boxName: String(row.box_name),
    seriesName: String(row.series_name ?? 'シリーズ未設定'),
    characterName: String(row.character_name),
    variantName: String(row.variant_name),
    quantity: Number(row.quantity),
    imageUrl: (row.image_url as string | null) ?? null,
    status: String(row.status ?? 'owned') as GoodsStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function migrate() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS goods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jan_code TEXT,
      box_name TEXT NOT NULL,
      series_name TEXT NOT NULL DEFAULT 'シリーズ未設定',
      character_name TEXT NOT NULL,
      variant_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'owned',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_goods_search ON goods(box_name, series_name, character_name, variant_name);
    CREATE INDEX IF NOT EXISTS idx_goods_jan ON goods(jan_code);
  `);

  try {
    await db.runAsync("ALTER TABLE goods ADD COLUMN series_name TEXT NOT NULL DEFAULT 'シリーズ未設定'");
  } catch {
    // Existing databases already have this column.
  }
}

export function GoodsProvider({ children }: PropsWithChildren) {
  const [goods, setGoods] = useState<Goods[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM goods ORDER BY created_at DESC, id DESC',
    );
    setGoods(rows.map(mapGoods));
  }, []);

  useEffect(() => {
    migrate()
      .then(refresh)
      .finally(() => setLoading(false));
  }, [refresh]);

  const addGoods = useCallback(
    async (input: GoodsInput) => {
      const normalized = normalizedGoodsInput(input);
      const existing = await db.getFirstAsync<{ id: number; image_url: string | null }>(
        `SELECT id, image_url
         FROM goods
         WHERE jan_code IS ?
           AND series_name = ?
           AND character_name = ?
           AND variant_name = ?
           AND status = ?
         ORDER BY id DESC
         LIMIT 1`,
        normalized.janCode,
        normalized.seriesName,
        normalized.characterName,
        normalized.variantName,
        normalized.status,
      );

      if (existing) {
        await db.runAsync(
          `UPDATE goods
           SET quantity = quantity + ?,
               image_url = COALESCE(image_url, ?),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          normalized.quantity,
          normalized.imageUrl,
          existing.id,
        );
        if (normalized.imageUrl && existing.image_url && existing.image_url !== normalized.imageUrl) {
          await deleteManagedLocalImage(normalized.imageUrl);
        }
        await refresh();
        return;
      }

      await db.runAsync(
        `INSERT INTO goods (jan_code, box_name, series_name, character_name, variant_name, quantity, image_url, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        normalized.janCode,
        normalized.boxName,
        normalized.seriesName,
        normalized.characterName,
        normalized.variantName,
        normalized.quantity,
        normalized.imageUrl,
        normalized.status,
      );
      await refresh();
    },
    [refresh],
  );

  const updateQuantity = useCallback(
    async (id: number, delta: number) => {
      await db.runAsync(
        `UPDATE goods
         SET quantity = MAX(quantity + ?, 0), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        delta,
        id,
      );
      await refresh();
    },
    [refresh],
  );

  const updateGoods = useCallback(
    async (id: number, input: GoodsInput) => {
      const previous = await db.getFirstAsync<{ image_url: string | null }>('SELECT image_url FROM goods WHERE id = ?', id);
      const normalized = normalizedGoodsInput(input);
      await db.runAsync(
        `UPDATE goods
         SET jan_code = ?,
             box_name = ?,
             series_name = ?,
             character_name = ?,
             variant_name = ?,
             quantity = ?,
             image_url = ?,
             status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        normalized.janCode,
        normalized.boxName,
        normalized.seriesName,
        normalized.characterName,
        normalized.variantName,
        Math.max(0, input.quantity ?? 0),
        normalized.imageUrl,
        normalized.status,
        id,
      );
      if (previous?.image_url && previous.image_url !== normalized.imageUrl) {
        await deleteManagedLocalImage(previous.image_url);
      }
      await refresh();
    },
    [refresh],
  );

  const bulkUpdateGoods = useCallback(
    async (ids: number[], patch: Partial<Pick<GoodsInput, 'seriesName' | 'characterName'>>) => {
      const targetIds = ids.filter((id) => Number.isFinite(id));
      if (!targetIds.length) return;

      const updates: string[] = [];
      const values: Array<string | number> = [];
      if (patch.seriesName !== undefined) {
        updates.push('series_name = ?');
        values.push(patch.seriesName.trim() || 'シリーズ未設定');
      }
      if (patch.characterName !== undefined) {
        updates.push('character_name = ?');
        values.push(patch.characterName.trim() || '未分類');
      }
      if (!updates.length) return;

      updates.push('updated_at = CURRENT_TIMESTAMP');
      const placeholders = targetIds.map(() => '?').join(', ');
      await db.runAsync(
        `UPDATE goods SET ${updates.join(', ')} WHERE id IN (${placeholders})`,
        ...values,
        ...targetIds,
      );
      await refresh();
    },
    [refresh],
  );

  const removeGoods = useCallback(
    async (id: number) => {
      const previous = await db.getFirstAsync<{ image_url: string | null }>('SELECT image_url FROM goods WHERE id = ?', id);
      await db.runAsync('DELETE FROM goods WHERE id = ?', id);
      await deleteManagedLocalImage(previous?.image_url);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ goods, loading, addGoods, updateGoods, bulkUpdateGoods, updateQuantity, removeGoods, refresh }),
    [addGoods, bulkUpdateGoods, goods, loading, refresh, removeGoods, updateGoods, updateQuantity],
  );

  return <GoodsContext.Provider value={value}>{children}</GoodsContext.Provider>;
}

export function useGoods() {
  const context = useContext(GoodsContext);
  if (!context) {
    throw new Error('useGoods must be used inside GoodsProvider');
  }
  return context;
}
