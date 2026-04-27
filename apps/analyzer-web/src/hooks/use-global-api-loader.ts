import { useEffect, useState } from "react";
import {
  subscribeToGlobalApiLoader,
  type GlobalApiLoaderState,
} from "@/config/axios";

const initialState: GlobalApiLoaderState = {
  isLoading: false,
  pendingCount: 0,
};

export const useGlobalApiLoader = () => {
  const [state, setState] = useState<GlobalApiLoaderState>(initialState);

  useEffect(() => {
    return subscribeToGlobalApiLoader(setState);
  }, []);

  return state;
};
