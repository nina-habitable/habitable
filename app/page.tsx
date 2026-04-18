import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Habitable — Check Any NYC Building Before You Sign",
  description: "Free building reports for NYC renters. HPD violations, complaints, ownership history, and safety data translated into plain English.",
  openGraph: {
    title: "Habitable — Check Any NYC Building Before You Sign",
    description: "Free building reports for NYC renters. HPD violations, complaints, ownership history, and safety data translated into plain English.",
    type: "website",
    url: "https://habitable-xi.vercel.app",
  },
  twitter: {
    card: "summary",
    title: "Habitable — Check Any NYC Building Before You Sign",
    description: "Free building reports for NYC renters. HPD violations, complaints, ownership history, and safety data translated into plain English.",
  },
};

export default function Home() {
  return <HomeClient />;
}
