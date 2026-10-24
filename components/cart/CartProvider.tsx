"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

const STORAGE_KEY = "rasa-medan-cart";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  variant: string | null;
  quantity: number;
  image: string | null;
  category: string;
  /** Berat satuan produk (gram) untuk perkiraan total berat. Skill 13. */
  weight_grams: number;
};

/** Batas qty per baris — sama dengan batas server di POST /api/orders. */
export const MAX_QTY = 99;

/**
 * Sanitasi isi localStorage (bisa berasal dari versi lama atau dimanipulasi):
 * buang baris rusak, lengkapi field yang hilang. Harga di sini hanya tampilan —
 * harga final selalu dihitung ulang server saat checkout.
 */
function sanitizeStored(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const it = r as Record<string, unknown>;
    const productId = Number(it.productId);
    const quantity = Number(it.quantity);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    out.push({
      productId,
      slug: String(it.slug ?? ""),
      name: String(it.name ?? ""),
      price: Number(it.price) || 0,
      variant: typeof it.variant === "string" && it.variant ? it.variant : null,
      quantity: Math.min(MAX_QTY, quantity),
      image: typeof it.image === "string" ? it.image : null,
      category: String(it.category ?? ""),
      weight_grams: Number(it.weight_grams) || 0,
    });
  }
  return out;
}

/** Kunci unik per baris keranjang = produk + variasi. */
function keyOf(productId: number, variant: string | null): string {
  return `${productId}::${variant ?? ""}`;
}

type CartContextValue = {
  items: CartItem[];
  /** Sudah membaca localStorage (hindari mismatch hidrasi pada badge). */
  hydrated: boolean;
  count: number;
  subtotal: number;
  /** Perkiraan total berat (gram) dari berat produk × qty. */
  totalWeight: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: number, variant: string | null, quantity: number) => void;
  removeItem: (productId: number, variant: string | null) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Muat dari localStorage saat mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Hidrasi dari localStorage hanya bisa setelah mount (render awal = server).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(sanitizeStored(JSON.parse(raw)));
      }
    } catch {
      /* abaikan */
    }
    setHydrated(true);
  }, []);

  // Simpan ke localStorage setiap perubahan (setelah hidrasi).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* abaikan */
    }
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((prev) => {
        const k = keyOf(item.productId, item.variant);
        const idx = prev.findIndex(
          (it) => keyOf(it.productId, it.variant) === k
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: Math.min(MAX_QTY, next[idx].quantity + quantity),
          };
          return next;
        }
        return [...prev, { ...item, quantity: Math.min(MAX_QTY, quantity) }];
      });
    },
    []
  );

  const setQuantity = useCallback(
    (productId: number, variant: string | null, quantity: number) => {
      setItems((prev) => {
        const k = keyOf(productId, variant);
        if (quantity <= 0) {
          return prev.filter((it) => keyOf(it.productId, it.variant) !== k);
        }
        return prev.map((it) =>
          keyOf(it.productId, it.variant) === k
            ? { ...it, quantity: Math.min(MAX_QTY, quantity) }
            : it
        );
      });
    },
    []
  );

  const removeItem = useCallback(
    (productId: number, variant: string | null) => {
      setItems((prev) =>
        prev.filter(
          (it) => keyOf(it.productId, it.variant) !== keyOf(productId, variant)
        )
      );
    },
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((n, it) => n + it.quantity, 0),
    [items]
  );
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [items]
  );
  const totalWeight = useMemo(
    () => items.reduce((sum, it) => sum + (it.weight_grams ?? 0) * it.quantity, 0),
    [items]
  );

  const value: CartContextValue = {
    items,
    hydrated,
    count,
    subtotal,
    totalWeight,
    addItem,
    setQuantity,
    removeItem,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus dipakai di dalam <CartProvider>");
  return ctx;
}
