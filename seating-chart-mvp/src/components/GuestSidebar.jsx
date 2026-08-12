import React, { useMemo, useState } from 'react';

const DIET_LABELS = {
  none: 'Sin restricción',
  vegan: 'Vegano',
  vegetarian: 'Vegetariano',
  gluten_free: 'Sin gluten',
  other: 'Otro',
};

/**
 * GuestSidebar
 *
 * Lists unseated guests and lets the user drag them (native HTML5 DnD)
 * onto SeatingCanvas, which resolves the drop to the nearest empty seat.
 *
 * Props:
 *  - guests: full guest list for the event
 *  - onAddGuest(name): optional quick-add handler
 */
export default function GuestSidebar({ guests, onAddGuest }) {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const unassigned = useMemo(
    () =>
      guests
        .filter((g) => !g.table_id)
        .filter((g) => g.name.toLowerCase().includes(query.toLowerCase())),
    [guests, query]
  );

  const handleDragStart = (e, guest) => {
    e.dataTransfer.setData('text/guest-id', guest.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim() || !onAddGuest) return;
    onAddGuest(newName.trim());
    setNewName('');
  };

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col border-l border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Invitados sin mesa
        </h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar invitado..."
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {unassigned.map((guest) => (
          <li
            key={guest.id}
            draggable
            onDragStart={(e) => handleDragStart(e, guest)}
            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm cursor-grab active:cursor-grabbing hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
          >
            <span className="truncate font-medium text-gray-800">{guest.name}</span>
            {guest.status_diet !== 'none' && (
              <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5">
                {DIET_LABELS[guest.status_diet]}
              </span>
            )}
          </li>
        ))}
        {unassigned.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-6">
            Todos los invitados tienen mesa asignada.
          </li>
        )}
      </ul>

      {onAddGuest && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del invitado"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Añadir
          </button>
        </form>
      )}
    </aside>
  );
}
