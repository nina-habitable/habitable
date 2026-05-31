import Link from "next/link";
import type { ReactNode } from "react";

export default function EntityLink({ name, label, className }: { name: string; label?: ReactNode; className?: string }) {
  return (
    <Link
      href={`/portfolio?name=${encodeURIComponent(name)}`}
      className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${className ?? ""}`}
    >
      {label ?? <>{name}<span aria-hidden className="ml-0.5">&#8599;</span></>}
    </Link>
  );
}
