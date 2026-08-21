import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { EventPlan } from '../types';

type EventContextValue = {
  events: EventPlan[];
  selectedEventId: string;
  addEvent: (input: Omit<EventPlan, 'id'>) => Promise<string>;
  replaceEvents: (nextEvents: EventPlan[], nextSelectedEventId?: string) => Promise<void>;
  updateEvent: (id: string, input: Omit<EventPlan, 'id'>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  setSelectedEventId: (id: string) => Promise<void>;
};

const STORAGE_KEY = 'oshilist.events.v1';
const SELECTED_KEY = 'oshilist.events.selected.v1';

const EventContext = createContext<EventContextValue | null>(null);

function createId() {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readEvents(stored: string): EventPlan[] {
  try {
    const parsed = JSON.parse(stored) as EventPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function EventProvider({ children }: PropsWithChildren) {
  const [events, setEvents] = useState<EventPlan[]>([]);
  const [selectedEventIdState, setSelectedEventIdState] = useState('');

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SELECTED_KEY)]).then(([storedEvents, storedSelected]) => {
      if (storedEvents) setEvents(readEvents(storedEvents));
      if (storedSelected) setSelectedEventIdState(storedSelected);
    });
  }, []);

  const persistEvents = async (nextEvents: EventPlan[]) => {
    setEvents(nextEvents);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
  };

  const addEvent = async (input: Omit<EventPlan, 'id'>) => {
    const event: EventPlan = { ...input, id: createId() };
    const nextEvents = [event, ...events];
    await persistEvents(nextEvents);
    await setSelectedEventId(event.id);
    return event.id;
  };

  const replaceEvents = async (nextEvents: EventPlan[], nextSelectedEventId = '') => {
    const sanitizedEvents = nextEvents
      .filter((event) => event && typeof event.id === 'string' && event.id.trim())
      .map((event) => ({
        id: event.id.trim(),
        name: event.name?.trim() || 'イベント未設定',
        date: event.date?.trim() || '',
        venue: event.venue?.trim() || '',
        memo: event.memo?.trim() || '',
      }));
    const selectedId = sanitizedEvents.some((event) => event.id === nextSelectedEventId)
      ? nextSelectedEventId
      : sanitizedEvents[0]?.id ?? '';
    setEvents(sanitizedEvents);
    setSelectedEventIdState(selectedId);
    await AsyncStorage.multiSet([
      [STORAGE_KEY, JSON.stringify(sanitizedEvents)],
      [SELECTED_KEY, selectedId],
    ]);
  };

  const updateEvent = async (id: string, input: Omit<EventPlan, 'id'>) => {
    await persistEvents(events.map((event) => (event.id === id ? { ...input, id } : event)));
  };

  const removeEvent = async (id: string) => {
    const nextEvents = events.filter((event) => event.id !== id);
    await persistEvents(nextEvents);
    if (selectedEventIdState === id) {
      const nextSelected = nextEvents[0]?.id ?? '';
      setSelectedEventIdState(nextSelected);
      await AsyncStorage.setItem(SELECTED_KEY, nextSelected);
    }
  };

  const setSelectedEventId = async (id: string) => {
    setSelectedEventIdState(id);
    await AsyncStorage.setItem(SELECTED_KEY, id);
  };

  const selectedEventId = selectedEventIdState || events[0]?.id || '';
  const value = useMemo(
    () => ({ events, selectedEventId, addEvent, replaceEvents, updateEvent, removeEvent, setSelectedEventId }),
    [events, selectedEventId],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used inside EventProvider');
  return context;
}
