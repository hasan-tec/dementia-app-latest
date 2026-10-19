/**
 * Onboarding Event Bus
 * Dispatches real application lifecycle events so the guided tour
 * advances only upon actual successful actions, never just button clicks.
 */

export interface TourEventMap {
  'person:save-success': { id: string | number; name: string };
  'enrollment:status': { status: string };
  'conversation:save-success': { id: string | number };
  'camera:state': { active: boolean; state: string };
  'route:ready': { path: string };
  'modal:open': { modalId: string };
  'modal:close': { modalId: string };
}

type EventCallback<T> = (data: T) => void;

class TourEventEmitter {
  private listeners = new Map<keyof TourEventMap, Set<EventCallback<any>>>();

  public on<K extends keyof TourEventMap>(event: K, callback: EventCallback<TourEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);

    return () => {
      set?.delete(callback);
    };
  }

  public emit<K extends keyof TourEventMap>(event: K, data: TourEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in tour listener for ${event}:`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const tourEvents = new TourEventEmitter();
