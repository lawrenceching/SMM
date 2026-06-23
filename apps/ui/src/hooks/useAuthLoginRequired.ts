import { useSyncExternalStore } from 'react';
import {
  getAuthLoginRequired,
  subscribeAuthLoginRequired,
} from '@/lib/authSession';

export function useAuthLoginRequired(): boolean {
  return useSyncExternalStore(
    subscribeAuthLoginRequired,
    getAuthLoginRequired,
    getAuthLoginRequired,
  );
}
