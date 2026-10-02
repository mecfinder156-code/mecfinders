'use client';

import { SWRConfig } from 'swr';
import React from 'react';

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false, // Mobile webviews can spam focus events
        revalidateOnReconnect: true, // Recover after network drop
        dedupingInterval: 5000, // Wait at least 5s before repeating the exact same call
        errorRetryCount: 3,
        focusThrottleInterval: 10000,
      }}
    >
      {children}
    </SWRConfig>
  );
};
