/**
 * Generates a random color number suitable for Phaser's setTint method
 * @returns A color value in the format 0xRRGGBB
 */
export function getRandomColor(): number {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  return (r << 16) | (g << 8) | b;
}
