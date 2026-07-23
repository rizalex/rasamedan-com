import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/products";
import { formatRupiah } from "@/lib/format";
import { SITE_NAME } from "@/lib/seo";
import { IconCake, IconSnack, IconBottle } from "@/components/ui/icons";
import StockBadge from "./StockBadge";
import styles from "./ProductCard.module.css";

function CategoryIcon({ category }: { category: string }) {
  if (category === "kering") return <IconSnack size={26} />;
  if (category === "sirup") return <IconBottle size={26} />;
  return <IconCake size={26} />; // default: kue
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/produk/${product.slug}`} className={styles.card}>
      <div className={styles.thumb}>
        <span className={styles.badgeOverlay}>
          <StockBadge status={product.stock_status} />
        </span>
        {product.image ? (
          <Image
            src={product.image}
            alt={`${product.name} - ${SITE_NAME}`}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className={styles.image}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span className={styles.placeholder} aria-hidden>
            <CategoryIcon category={product.category} />
          </span>
        )}
      </div>
      <div className={styles.body}>
        <p className={styles.name}>{product.name}</p>
        <p className={styles.price}>{formatRupiah(product.price)}</p>
      </div>
    </Link>
  );
}
