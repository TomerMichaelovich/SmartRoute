import { useMemo, useState, useTransition } from "react";
import type { MapChanges } from "@/src/infrastructure/repositories/interfaces/node-repository";
import {
  type MapHistory,
  type MapState,
  diffMap,
  hasMapChanges,
  pushChange,
  rebaseHistory,
  undoChange,
} from "./map-draft";

/**
 * The map editor's draft over the saved map: `change` adds an undoable step, `save` writes the
 * whole draft at once. `saved` must keep its identity until the saved map really changes.
 */
export function useMapDraft(saved: MapState) {
  const [history, setHistory] = useState<MapHistory | null>(null);
  const [seenSaved, setSeenSaved] = useState(saved);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // The saved map changed (products, an upload, another admin): the draft carries over onto it.
  if (seenSaved !== saved) {
    setSeenSaved(saved);
    if (history) setHistory(rebaseHistory(history, saved));
  }

  const map = history?.present ?? saved;
  const isDirty = useMemo(() => (history ? hasMapChanges(diffMap(history.base, history.present)) : false), [history]);

  function change(update: (map: MapState) => MapState) {
    if (saving) return;
    setSaveError(null);
    setHistory((h) => pushChange(h, saved, update(h?.present ?? saved)));
  }

  /** Steps back and returns the map it landed on, or null when there was nothing to undo. */
  function undo(): MapState | null {
    if (saving || !history) return null;
    setSaveError(null);
    setHistory(undoChange);
    return history.past.at(-1) ?? saved;
  }

  /** Writes `final` (the draft, with anything still being drawn added to it). */
  function save(final: MapState, persist: (changes: MapChanges) => Promise<void>) {
    if (saving) return;
    const changes = diffMap(history?.base ?? saved, final);
    if (!hasMapChanges(changes)) {
      setHistory(null);
      return;
    }
    if (final !== map) setHistory((h) => pushChange(h, saved, final));
    setSaveError(null);
    startSaving(async () => {
      try {
        await persist(changes);
        // In the transition, so the draft only goes once the refreshed map is on screen.
        startSaving(() => setHistory(null));
      } catch (error) {
        console.error(error);
        setSaveError("השמירה נכשלה. השינויים לא אבדו - נסו לשמור שוב.");
      }
    });
  }

  return { map, isDirty, canUndo: history !== null, saving, saveError, change, undo, save };
}
