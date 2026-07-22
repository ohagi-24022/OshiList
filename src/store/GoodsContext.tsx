import * as SQLite from 'expo-sqlite';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Goods, GoodsInput, GoodsStatus } from '../types';

type GoodsContextValue = {
  goods: Goods[];
  loading: boolean;
  addGoods: (input: GoodsInput) => Promise<void>;
  updateGoods: (id: number, input: GoodsInput) => Promise<void>;
  updateQuantity: (id: number, delta: number) => Promise<void>;
  removeGoods: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const GoodsContext = createContext<GoodsContextValue | null>(null);

const db = SQLite.openDatabaseSync('oshilist.db');

function mapGoods(row: Record<string, unknown>): Goods {
  return {
    id: Number(row.id),
    janCode: (row.jan_code as string | null) ?? null,
    boxName: String(row.box_name),
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
      character_name TEXT NOT NULL,
      variant_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'owned',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_goods_search ON goods(box_name, character_name, variant_name);
    CREATE INDEX IF NOT EXISTS idx_goods_jan ON goods(jan_code);
  `);
}

export function GoodsProvider({ children }: PropsWithChildren) {
  const [goods, setGoods] = useState<Goods[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM goods ORDER BY updated_at DESC, id DESC',
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
      await db.runAsync(
        `INSERT INTO goods (jan_code, box_name, character_name, variant_name, quantity, image_url, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        input.janCode ?? null,
        input.boxName.trim(),
        input.characterName.trim(),
        input.variantName.trim() || '通常版',
        input.quantity ?? 1,
        input.imageUrl ?? null,
        input.status ?? 'owned',
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
      await db.runAsync(
        `UPDATE goods
         SET jan_code = ?,
             box_name = ?,
             character_name = ?,
             variant_name = ?,
             quantity = ?,
             image_url = ?,
             status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        input.janCode ?? null,
        input.boxName.trim(),
        input.characterName.trim() || '未分類',
        input.variantName.trim() || '通常版',
        Math.max(0, input.quantity ?? 0),
        input.imageUrl ?? null,
        input.status ?? 'owned',
        id,
      );
      await refresh();
    },
    [refresh],
  );

  const removeGoods = useCallback(
    async (id: number) => {
      await db.runAsync('DELETE FROM goods WHERE id = ?', id);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ goods, loading, addGoods, updateGoods, updateQuantity, removeGoods, refresh }),
    [addGoods, goods, loading, refresh, removeGoods, updateGoods, updateQuantity],
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
