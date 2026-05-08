import { useState, useEffect } from "react";
import { TimeEntry } from "../types";
import { api } from "../api/client";

type NewEntry = {
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
};

export function useEntries(week: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TimeEntry[]>(`/entries?week=${week}`);
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (week) fetchEntries(); }, [week]);

  const addEntry = async (payload: NewEntry) => {
    const entry = await api.post<TimeEntry>("/entries", payload);
    setEntries((prev) =>
      [...prev, entry].sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
      )
    );
    return entry;
  };

  const updateEntry = async (id: string, payload: Partial<NewEntry>) => {
    const entry = await api.put<TimeEntry>(`/entries/${id}`, payload);
    setEntries((prev) => prev.map((e) => (e.id === id ? entry : e)));
    return entry;
  };

  const deleteEntry = async (id: string) => {
    await api.delete<{ ok: boolean }>(`/entries/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const submitDay = async (date: string) => {
    await api.post<{ submitted: number }>("/entries/submit", { date });
    setEntries((prev) =>
      prev.map((e) =>
        e.date === date && e.status === "DRAFT" ? { ...e, status: "PENDING" as const } : e
      )
    );
  };

  return { entries, loading, error, addEntry, updateEntry, deleteEntry, submitDay, refetch: fetchEntries };
}
