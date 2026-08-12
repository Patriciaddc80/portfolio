import React, { useCallback, useEffect, useState } from 'react';
import SeatingCanvas from './components/SeatingCanvas';
import GuestSidebar from './components/GuestSidebar';
import { supabase } from './lib/supabaseClient';

/**
 * App — wires SeatingCanvas + GuestSidebar to Supabase (fetch + realtime).
 * Replace EVENT_ID with the active event's id (e.g. from route params).
 */
export default function App({ eventId }) {
  const [tables, setTables] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: tablesData }, { data: guestsData }] = await Promise.all([
        supabase.from('tables').select('*').eq('event_id', eventId),
        supabase.from('guests').select('*').eq('event_id', eventId),
      ]);
      if (cancelled) return;
      setTables(tablesData ?? []);
      setGuests(guestsData ?? []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Realtime subscriptions — keep local state in sync with remote changes
  // (e.g. a co-planner editing the same event from another tab).
  useEffect(() => {
    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setTables((prev) => applyChange(prev, payload));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setGuests((prev) => applyChange(prev, payload));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // --- Persistence callbacks passed down to the canvas / sidebar ---

  // Optimistic local update + debounced-free direct write; Supabase's own
  // realtime echo is deduped by applyChange matching on `id`.
  const handleTableChange = useCallback(
    async (tableId, updates) => {
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, ...updates } : t)));
      const { error } = await supabase.from('tables').update(updates).eq('id', tableId);
      if (error) console.error('Failed to persist table update:', error);
    },
    []
  );

  const handleAssignGuest = useCallback(async (guestId, tableId, seatNumber) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table_id: tableId, seat_number: seatNumber } : g))
    );
    const { error } = await supabase
      .from('guests')
      .update({ table_id: tableId, seat_number: seatNumber })
      .eq('id', guestId);
    if (error) console.error('Failed to seat guest:', error);
  }, []);

  const handleUnassignGuest = useCallback(async (guestId) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table_id: null, seat_number: null } : g))
    );
    const { error } = await supabase
      .from('guests')
      .update({ table_id: null, seat_number: null })
      .eq('id', guestId);
    if (error) console.error('Failed to unseat guest:', error);
  }, []);

  const handleAddGuest = useCallback(
    async (name) => {
      const { data, error } = await supabase
        .from('guests')
        .insert({ event_id: eventId, name })
        .select()
        .single();
      if (error) return console.error('Failed to add guest:', error);
      setGuests((prev) => [...prev, data]);
    },
    [eventId]
  );

  if (loading) return <div className="p-8 text-gray-500">Cargando plano...</div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <main className="flex-1">
        <SeatingCanvas
          tables={tables}
          guests={guests}
          onTableChange={handleTableChange}
          onAssignGuest={handleAssignGuest}
          onUnassignGuest={handleUnassignGuest}
        />
      </main>
      <GuestSidebar guests={guests} onAddGuest={handleAddGuest} />
    </div>
  );
}

/** Merge a Supabase realtime payload into a local list, keyed by id. */
function applyChange(list, payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  if (eventType === 'INSERT') {
    return list.some((r) => r.id === newRow.id) ? list : [...list, newRow];
  }
  if (eventType === 'UPDATE') {
    return list.map((r) => (r.id === newRow.id ? newRow : r));
  }
  if (eventType === 'DELETE') {
    return list.filter((r) => r.id !== oldRow.id);
  }
  return list;
}
