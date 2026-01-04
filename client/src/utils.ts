import { config } from "./config";

function lightenColor(hexColor: number, factor: number = 0.4): number {
    const r = (hexColor >> 16) & 0xFF;
    const g = (hexColor >> 8) & 0xFF;
    const b = hexColor & 0xFF;
    
    // Interpolate each component toward 255 (white)
    const newR = Math.floor(r + (255 - r) * factor);
    const newG = Math.floor(g + (255 - g) * factor);
    const newB = Math.floor(b + (255 - b) * factor);
    
    return (newR << 16) | (newG << 8) | newB;
}

// Helper function to darken a color by multiplying with a gray value
function darkenColor(hexColor: number, factor: number = 0.4): number {
    const r = Math.floor(((hexColor >> 16) & 0xFF) * factor);
    const g = Math.floor(((hexColor >> 8) & 0xFF) * factor);
    const b = Math.floor((hexColor & 0xFF) * factor);
    return (r << 16) | (g << 8) | b;
}

export {lightenColor, darkenColor};