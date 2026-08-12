// Pure geometry helpers — no React/Konva dependency, easy to unit test.

const CHAIR_RADIUS = 12;
const CHAIR_OFFSET = 26; // distance from table edge to chair center

/**
 * Returns chair positions relative to a table's local (0,0) origin,
 * BEFORE the table's own rotation/scale/position transform is applied
 * (Konva applies that transform on the parent Group, so children stay simple).
 */
export function getChairPositions(table) {
  const { type, target_chairs, width = 160, height = 80 } = table;
  const seats = [];

  if (type === 'round') {
    const radius = Math.max(width, height) / 2 + CHAIR_OFFSET;
    const angleStep = (2 * Math.PI) / target_chairs;
    for (let i = 0; i < target_chairs; i++) {
      const angle = i * angleStep - Math.PI / 2;
      seats.push({
        seatNumber: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
    return seats;
  }

  // Rectangular: distribute chairs along the two long sides first, then short sides.
  const perLong = Math.ceil(target_chairs / 2);
  const halfW = width / 2;
  const halfH = height / 2;
  let seatNumber = 0;

  for (let side = 0; side < 2 && seatNumber < target_chairs; side++) {
    const y = side === 0 ? -halfH - CHAIR_OFFSET : halfH + CHAIR_OFFSET;
    const count = Math.min(perLong, target_chairs - seatNumber);
    for (let i = 0; i < count; i++) {
      const spacing = width / (count + 1);
      seats.push({ seatNumber, x: -halfW + spacing * (i + 1), y });
      seatNumber++;
    }
  }

  return seats;
}

export const CHAIR_RADIUS_PX = CHAIR_RADIUS;

/** Rotate+scale a local point by the table's transform, then translate to world space. */
export function localToWorld(table, point) {
  const rad = (table.rotation * Math.PI) / 180;
  const scale = table.scale ?? 1;
  const x = point.x * scale;
  const y = point.y * scale;
  return {
    x: table.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: table.y + x * Math.sin(rad) + y * Math.cos(rad),
  };
}

/** Find the nearest empty seat (across all tables) to a world-space point, within maxDist. */
export function findNearestEmptySeat(tables, guests, point, maxDist = 40) {
  let best = null;
  let bestDist = maxDist;

  for (const table of tables) {
    const seats = getChairPositions(table);
    for (const seat of seats) {
      const occupied = guests.some(
        (g) => g.table_id === table.id && g.seat_number === seat.seatNumber
      );
      if (occupied) continue;

      const world = localToWorld(table, seat);
      const dist = Math.hypot(world.x - point.x, world.y - point.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { tableId: table.id, seatNumber: seat.seatNumber };
      }
    }
  }

  return best;
}
