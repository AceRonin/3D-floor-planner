export function getEquipmentFootprintMm(equipment) {
  const rotation = ((equipment.rotationYDeg % 180) + 180) % 180;
  return rotation === 90
    ? { widthMm: equipment.sizeMm.depth, depthMm: equipment.sizeMm.width }
    : { widthMm: equipment.sizeMm.width, depthMm: equipment.sizeMm.depth };
}

export function validateEquipmentPlacement(equipment, room, existingEquipment = []) {
  const { dimensions } = room;
  const { positionMm, sizeMm, mountType, rotationYDeg } = equipment;
  const values = [
    positionMm?.x,
    positionMm?.y,
    positionMm?.z,
    sizeMm?.width,
    sizeMm?.depth,
    sizeMm?.height,
    rotationYDeg,
  ];

  if (!values.every(Number.isFinite) || values.slice(3, 6).some((value) => value <= 0)) {
    return { isValid: false, error: 'Equipment dimensions and position must be valid numbers.' };
  }
  if (mountType !== 'floor' && mountType !== 'wall') {
    return { isValid: false, error: 'Equipment must be floor-mounted or wall-mounted.' };
  }
  if (rotationYDeg % 90 !== 0) {
    return { isValid: false, error: 'Equipment rotation must use 90-degree steps.' };
  }

  const footprint = getEquipmentFootprintMm(equipment);
  const halfRoomLength = dimensions.length / 2 - dimensions.wallThickness;
  const halfRoomWidth = dimensions.width / 2 - dimensions.wallThickness;
  const floorBaseMm = room.hasInsulatedFloor ? dimensions.wallThickness : 0;
  const ceilingBaseMm = dimensions.height - dimensions.wallThickness;
  const halfWidth = footprint.widthMm / 2;
  const halfDepth = footprint.depthMm / 2;
  const halfHeight = sizeMm.height / 2;

  if (positionMm.x - halfWidth < -halfRoomLength || positionMm.x + halfWidth > halfRoomLength) {
    return { isValid: false, error: 'Equipment exceeds the room length.' };
  }
  if (positionMm.z - halfDepth < -halfRoomWidth || positionMm.z + halfDepth > halfRoomWidth) {
    return { isValid: false, error: 'Equipment exceeds the room width.' };
  }
  if (positionMm.y - halfHeight < floorBaseMm || positionMm.y + halfHeight > ceilingBaseMm) {
    return { isValid: false, error: 'Equipment exceeds the usable room height.' };
  }

  if (mountType === 'wall') {
    const wall = equipment.mountWall;
    const wallPositionIsValid = wall === 'north'
      ? Math.abs(positionMm.z + halfDepth - halfRoomWidth) <= 1
      : wall === 'south'
        ? Math.abs(positionMm.z - halfDepth + halfRoomWidth) <= 1
        : wall === 'east'
          ? Math.abs(positionMm.x + halfWidth - halfRoomLength) <= 1
          : wall === 'west'
            ? Math.abs(positionMm.x - halfWidth + halfRoomLength) <= 1
            : false;
    if (!wallPositionIsValid) {
      return { isValid: false, error: 'Wall equipment must sit against its selected wall.' };
    }
  }

  const hasCollision = existingEquipment.some((other) => {
    if (other.id === equipment.id) return false;
    const otherFootprint = getEquipmentFootprintMm(other);
    const otherHalfHeight = other.sizeMm.height / 2;
    return Math.abs(positionMm.x - other.positionMm.x) < halfWidth + otherFootprint.widthMm / 2 &&
      Math.abs(positionMm.y - other.positionMm.y) < halfHeight + otherHalfHeight &&
      Math.abs(positionMm.z - other.positionMm.z) < halfDepth + otherFootprint.depthMm / 2;
  });

  if (hasCollision) return { isValid: false, error: 'Equipment overlaps another item.' };
  return { isValid: true, error: null };
}