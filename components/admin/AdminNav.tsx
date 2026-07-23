"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconHome,
  IconClipboard,
  IconBox,
  IconTag,
  IconGear,
} from "@/components/ui/icons";
import styles from "./admin.module.css";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: IconHome },
  { href: "/admin/pesanan", label: "Pesanan", Icon: IconClipboard },
  { href: "/admin/produk", label: "Produk", Icon: IconBox },
  { href: "/admin/kategori", label: "Kategori", Icon: IconTag },
  { href: "/admin/pengaturan", label: "Pengaturan", Icon: IconGear },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/rasa-medan-mark.svg"
          alt="Rasa Medan"
          className={styles.sidebarMark}
        />
        <span className={styles.sidebarBrandText}>
          <strong>Rasa Medan</strong>
          <small>Admin Panel</small>
        </span>
      </div>

      <nav className={styles.sidebarNav}>
        {LINKS.map(({ href, label, Icon }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.sidebarLink} ${active ? styles.sidebarActive : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <button type="button" className={styles.sidebarLogout} onClick={logout}>
        Keluar
      </button>
    </aside>
  );
}
