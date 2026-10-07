import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { readMemory, writeMemory } from "@/shared/lib/sessionMemory";

/**
 * `useState` that survives the screen being rebuilt — see sessionMemory for why
 * a list needs that. Same signature as `useState`, plus the key it is kept under.
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readMemory(key, initial));
  useEffect(() => {
    writeMemory(key, value);
  }, [key, value]);
  return [value, setValue];
}
