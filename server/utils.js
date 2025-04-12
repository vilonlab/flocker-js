// Simple HSL to Hex conversion (or use a library like 'color-convert')
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`); // Return as hex number for Phaser tint
  }
  
  function getRandomColor() {
      // Generate random hue, keep saturation and lightness relatively constant
      const hue = Math.random() * 360; // 0-360
      const saturation = 80; // 0-100%
      const lightness = 60;  // 0-100%
  
      const playerColorHex = hslToHex(hue, saturation, lightness);
  
      // Get a contrasting hue for the emote (add 180 degrees)
      const contrastingHue = (hue + 180) % 360;
      const emoteColorHex = hslToHex(contrastingHue, saturation, lightness); // Use slightly different lightness?
  
      return {
          color: playerColorHex, // e.g., 0xff8844
          emoteColor: emoteColorHex
      };
  }
  
  module.exports = { getRandomColor };