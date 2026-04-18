import type { Metadata } from "next";
import CompareClient from "./CompareClient";

export const metadata: Metadata = {
  title: "Compare Buildings | Habitable",
  description: "Compare up to 3 NYC buildings side by side. Violations, complaints, scores, and ownership data.",
  openGraph: {
    title: "Compare Buildings | Habitable",
    description: "Compare up to 3 NYC buildings side by side. Violations, complaints, scores, and ownership data.",
    type: "website",
    url: "https://habitable-xi.vercel.app/compare",
  },
  twitter: {
    card: "summary",
    title: "Compare Buildings | Habitable",
    description: "Compare up to 3 NYC buildings side by side.",
  },
};

export default function ComparePage() {
  return <CompareClient />;
}
