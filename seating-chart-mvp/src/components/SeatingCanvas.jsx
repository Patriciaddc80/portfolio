import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Group, Circle, Rect, Text, Transformer } from 'react-konva';
import { getChairPositions, findNearestEmptySeat } from '../lib/seatLayout';

/**
 * SeatingCanvas
 *
 * Renders round/rectangular tables with chairs, lets the user drag/rotate/scale
 * tables, and accepts guests dropped from GuestSidebar (native HTML5 DnD) onto
 * empty chairs.
 *
 * Props:
 *  - tables:  [{ id, type, x, y, rotation, scale, target_chairs, width, height, label }]
 *  - guests:  [{ id, name, table_id, seat_number, status_diet }]
 *  - onTableChange(tableId, { x, y, rotation, scale })  -> called on drag/transform end
 *  - onAssignGuest(guestId, tableId, seatNumber)         -> called when a guest is dropped on a seat
 *  - onUnassignGuest(guestId)                            -> called when a seated guest is dragged back out
 */
export default function SeatingCanvas({
  tables,
  guests,
  onTableChange,
  onAssignGuest,
  onUnassignGuest,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const tableNodeRefs = useRef({});

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selectedTableId, setSelectedTableId] = useState(null);

  // Keep the stage sized to its container (responsive, no layout thrash on resize).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height: height || 600 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Attach the Transformer to the selected table node so the user can rotate/scale it.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedTableId ? tableNodeRefs.current[selectedTableId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedTableId, tables]);

  const handleTableDragEnd = useCallback(
    (table, e) => {
      onTableChange(table.id, {
        x: e.target.x(),
        y: e.target.y(),
        rotation: table.rotation,
        scale: table.scale,
      });
    },
    [onTableChange]
  );

  // Fired after rotate/resize via the Transformer handles.
  const handleTransformEnd = useCallback(
    (table, e) => {
      const node = e.target;
      const newScale = node.scaleX(); // uniform scale, keep aspect ratio
      onTableChange(table.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scale: newScale,
      });
    },
    [onTableChange]
  );

  const handleStageMouseDown = useCallback((e) => {
    // Clicking empty canvas space deselects the current table.
    if (e.target === e.target.getStage()) {
      setSelectedTableId(null);
    }
  }, []);

  // --- Native HTML5 drag-and-drop bridge for guests coming from the sidebar ---
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const guestId = e.dataTransfer.getData('text/guest-id');
      if (!guestId) return;

      const stage = stageRef.current;
      const stageBox = stage.container().getBoundingClientRect();
      const point = {
        x: e.clientX - stageBox.left,
        y: e.clientY - stageBox.top,
      };

      const target = findNearestEmptySeat(tables, guests, point);
      if (target) {
        onAssignGuest(guestId, target.tableId, target.seatNumber);
      }
    },
    [tables, guests, onAssignGuest]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleStageMouseDown}
        onTouchStart={handleStageMouseDown}
      >
        <Layer listening={false}>
          {/* Static background grid layer — non-interactive, cheap to redraw */}
        </Layer>
        <Layer>
          {tables.map((table) => (
            <TableNode
              key={table.id}
              table={table}
              guests={guests.filter((g) => g.table_id === table.id)}
              isSelected={selectedTableId === table.id}
              onSelect={() => setSelectedTableId(table.id)}
              onDragEnd={(e) => handleTableDragEnd(table, e)}
              onTransformEnd={(e) => handleTransformEnd(table, e)}
              onGuestDragStart={(guestId) => {
                // Let a seated guest be re-dragged elsewhere; sidebar handles the drop.
                if (onUnassignGuest) onUnassignGuest(guestId);
              }}
              registerNode={(node) => {
                if (node) tableNodeRefs.current[table.id] = node;
                else delete tableNodeRefs.current[table.id];
              }}
            />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              // Prevent flipping/inverting through zero.
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

/** A single table: shape + chairs + guest labels, all grouped so one drag moves everything. */
function TableNode({
  table,
  guests,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  registerNode,
}) {
  const chairs = getChairPositions(table);
  const guestBySeat = new Map(guests.map((g) => [g.seat_number, g]));

  return (
    <Group
      ref={registerNode}
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      scaleX={table.scale}
      scaleY={table.scale}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {table.type === 'round' ? (
        <Circle
          radius={Math.max(table.width, table.height) / 2}
          fill="#f5efe6"
          stroke={isSelected ? '#6366f1' : '#c9b98a'}
          strokeWidth={2}
        />
      ) : (
        <Rect
          x={-table.width / 2}
          y={-table.height / 2}
          width={table.width}
          height={table.height}
          cornerRadius={6}
          fill="#f5efe6"
          stroke={isSelected ? '#6366f1' : '#c9b98a'}
          strokeWidth={2}
        />
      )}

      {table.label && (
        <Text
          text={table.label}
          align="center"
          width={table.width}
          x={-table.width / 2}
          y={-8}
          fontSize={14}
          fill="#3f3a30"
        />
      )}

      {chairs.map((seat) => {
        const guest = guestBySeat.get(seat.seatNumber);
        return (
          <React.Fragment key={seat.seatNumber}>
            <Circle
              x={seat.x}
              y={seat.y}
              radius={12}
              fill={guest ? '#8ecae6' : '#ffffff'}
              stroke="#94897a"
              strokeWidth={1}
            />
            {guest && (
              <Text
                text={guest.name.slice(0, 2).toUpperCase()}
                x={seat.x - 12}
                y={seat.y - 6}
                width={24}
                align="center"
                fontSize={10}
                fill="#1f2937"
                listening={false}
              />
            )}
          </React.Fragment>
        );
      })}
    </Group>
  );
}
