"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ProcessingPoller({ documentId }: { documentId: string }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [documentId, router]);

  return null;
}
