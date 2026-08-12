# Seating Chart MVP

MVP de un planificador interactivo de asientos (bodas / eventos corporativos):
mesas arrastrables/rotables/escalables en un lienzo, y una lista de invitados
que se asignan a sillas mediante drag-and-drop.

## Stack y por qué

- **Canvas: [react-konva](https://konvajs.org/docs/react/index.html)** (Konva.js).
  Se eligió sobre Fabric.js porque expone un modelo declarativo basado en
  componentes React (`<Stage>/<Layer>/<Group>`) en vez de una API imperativa
  paralela al estado de React — evita tener que sincronizar dos fuentes de
  verdad a mano. Su `Transformer` nativo cubre rotar/escalar sin código extra,
  y el árbol de nodos (mesa → sillas) se declara igual que cualquier árbol de
  componentes.
- **Persistencia/tiempo real: Supabase** (Postgres + Realtime + RLS).
- **Estilos:** Tailwind CSS.

## Estructura

```
seating-chart-mvp/
├── sql/001_init.sql          # esquema, índices, RLS, realtime
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── seatLayout.js     # geometría pura: posiciones de sillas, hit-testing
│   ├── components/
│   │   ├── SeatingCanvas.jsx # lienzo Konva: mesas, sillas, drag/rotate/scale
│   │   └── GuestSidebar.jsx  # lista de invitados sin mesa (Tailwind)
│   └── App.jsx               # fetch inicial + suscripción realtime + writes
└── package.json
```

## Cómo correrlo

1. Crea un proyecto en Supabase y ejecuta `sql/001_init.sql` (SQL editor o CLI).
2. Copia `.env.example` a `.env` y rellena `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. `npm install`
4. `npm run dev`

## Rendimiento

- `SeatingCanvas` usa un único `ResizeObserver` para dimensionar el `Stage`
  (nada de listeners de `window.resize` repetidos).
- Cada mesa es un `<Group draggable>`; Konva sólo redibuja esa capa durante el
  arrastre, no todo el árbol.
- Las escrituras a Supabase sólo se disparan en `onDragEnd` / `onTransformEnd`
  (no en cada frame de arrastre), y el estado local se actualiza de forma
  optimista para que la UI no espere al round-trip de red.
- La geometría de sillas (`seatLayout.js`) es pura y sin dependencias de
  Konva, así que se puede testear/memoizar de forma aislada.
