import Link from "next/link";

export default function EntityLink({ name, className }: { name: string; className?: string }) {
  return (
    <Link
      href={`/portfolio?name=${encodeURIComponent(name)}`}
      className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${className ?? ""}`}
    >
      {name}
      <span aria-hidden className="ml-0.5">&#8599;</span>
    </Link>
  );
}
