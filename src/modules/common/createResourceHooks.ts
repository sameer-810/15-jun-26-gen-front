import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function createResourceHooks<
  TListQuery extends object,
  TCreatePayload extends object,
  TListResult,
>(
  key: string,
  api: {
    list: (query: TListQuery) => Promise<TListResult>;
    create: (payload: TCreatePayload) => Promise<unknown>;
    update: (id: string, payload: Partial<TCreatePayload>) => Promise<unknown>;
    remove: (id: string) => Promise<void>;
  },
) {
  const KEYS = {
    all: [key] as const,
    lists: () => [...KEYS.all, "list"] as const,
    list: (filters: TListQuery) => [...KEYS.lists(), filters] as const,
  };

  /**
   * `enabled: false` holds the request back until the caller has what it needs.
   *
   * `keepPrevious` leaves the rows already on screen in place while the next
   * page, search or filter loads, instead of swapping the whole list for a
   * spinner. Opt-in, because it is only right for a list someone is reading: a
   * picker scoped to one record must never show another record's rows, even for
   * a moment.
   */
  function useList(query: TListQuery, options?: { enabled?: boolean; keepPrevious?: boolean }) {
    return useQuery({
      queryKey: KEYS.list(query),
      queryFn: () => api.list(query),
      enabled: options?.enabled ?? true,
      placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: api.create,
      onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.lists() }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<TCreatePayload> }) =>
        api.update(id, payload),
      onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.lists() }),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: api.remove,
      onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.lists() }),
    });
  }

  return { KEYS, useList, useCreate, useUpdate, useDelete };
}
