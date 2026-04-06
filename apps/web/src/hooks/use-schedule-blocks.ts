"use client";

import { useState, useCallback } from "react";
import type { ScheduleBlock } from "@/types";

export function useScheduleBlocks() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);

  const fetchBlocks = useCallback(async (from: string, to: string) => {
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/schedule/blocks?${params}`);
      if (!res.ok) throw new Error("Error al cargar bloqueos");
      const data = await res.json() as { blocks: ScheduleBlock[] };
      setBlocks(data.blocks ?? []);
    } catch (error) {
      console.error("Error al cargar bloqueos:", error);
    }
  }, []);

  const createBlock = useCallback(
    async (startsAt: string, endsAt: string, reason?: string) => {
      const res = await fetch("/api/schedule/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt, endsAt, reason }),
      });
      if (!res.ok) throw new Error("Error al crear bloqueo");
      const data = await res.json() as { block: ScheduleBlock };
      setBlocks((prev) => [...prev, data.block]);
      return data.block;
    },
    []
  );

  const deleteBlock = useCallback(async (id: string) => {
    const res = await fetch(`/api/schedule/blocks?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar bloqueo");
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { blocks, fetchBlocks, createBlock, deleteBlock };
}
