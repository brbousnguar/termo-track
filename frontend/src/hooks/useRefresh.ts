import { useCallback, useState } from "react";

export function useRefresh() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return { refreshTick, refresh, refreshing };
}
