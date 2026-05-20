import { useState, useCallback } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((prevHistory) => {
      const nextPresent =
        typeof newState === 'function'
          ? (newState as (prev: T) => T)(prevHistory.present)
          : newState;

      return {
        past: [...prevHistory.past, prevHistory.present],
        present: nextPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.past.length === 0) return prevHistory;

      const newPast = prevHistory.past.slice(0, -1);
      const newPresent = prevHistory.past[prevHistory.past.length - 1];

      return {
        past: newPast,
        present: newPresent,
        future: [prevHistory.present, ...prevHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.future.length === 0) return prevHistory;

      const newFuture = prevHistory.future.slice(1);
      const newPresent = prevHistory.future[0];

      return {
        past: [...prevHistory.past, prevHistory.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
