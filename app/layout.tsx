import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Q-Build AI",
  description: "AI renovation shopping assistant for QHomemart competition",
};

const extensionHydrationCleanup = `
(() => {
  const extensionAttribute = /^(bis_|__processed_)/;

  const cleanElement = (element) => {
    if (!(element instanceof Element)) return;

    for (const attribute of Array.from(element.attributes)) {
      if (extensionAttribute.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  };

  const cleanTree = (root) => {
    cleanElement(root);
    if (root instanceof Element) {
      root.querySelectorAll("*").forEach(cleanElement);
    }
  };

  cleanTree(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        cleanElement(mutation.target);
      }

      for (const node of mutation.addedNodes) {
        cleanTree(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true
  });

  window.addEventListener("load", () => {
    cleanTree(document.documentElement);
    setTimeout(() => observer.disconnect(), 1000);
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: extensionHydrationCleanup }} />
        {children}
      </body>
    </html>
  );
}
