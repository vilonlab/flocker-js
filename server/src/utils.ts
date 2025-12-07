// Flocker server utility functions

import {config} from "./config";

// Helper method to generate distinct colors using HSL color space
// This ensures colors are dramatically different in hue
function generateDistinctColor(usedHues: Set<number>, minHueDifference: number = 60): string {
	const hueOptions: number[] = [];

	// Generate potential hues with good separation
	for (let hue = 0; hue < 360; hue += minHueDifference) {
		let isDistinct = true;
		for (const usedHue of usedHues) {
			const hueDiff = Math.min(
				Math.abs(hue - usedHue),
				360 - Math.abs(hue - usedHue)
			);
			if (hueDiff < minHueDifference) {
				isDistinct = false;
				break;
			}
		}
		if (isDistinct) {
			hueOptions.push(hue);
		}
	}

	// If no distinct hues available, reduce the minimum difference
	if (hueOptions.length === 0 && minHueDifference > config.player.minHueDifferenceFallback) {
		return generateDistinctColor(usedHues, minHueDifference - 10);
	}

	// Select random hue from available options
	const selectedHue = hueOptions.length > 0
		? hueOptions[Math.floor(Math.random() * hueOptions.length)]
		: Math.floor(Math.random() * 360);

	usedHues.add(selectedHue);

	// Use high saturation and medium lightness for vibrant colors
	const saturation = config.colors.saturation.min + Math.random() * (config.colors.saturation.max - config.colors.saturation.min);
	const lightness = config.colors.lightness.min + Math.random() * (config.colors.lightness.max - config.colors.lightness.min);

	return hslToHex(selectedHue, saturation, lightness);
}

// Helper method to convert HSL to hex color
function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs((h / 60) % 2 - 1));
	const m = l - c / 2;

	let r = 0, g = 0, b = 0;

	if (h >= 0 && h < 60) {
		r = c; g = x; b = 0;
	} else if (h >= 60 && h < 120) {
		r = x; g = c; b = 0;
	} else if (h >= 120 && h < 180) {
		r = 0; g = c; b = x;
	} else if (h >= 180 && h < 240) {
		r = 0; g = x; b = c;
	} else if (h >= 240 && h < 300) {
		r = x; g = 0; b = c;
	} else if (h >= 300 && h < 360) {
		r = c; g = 0; b = x;
	}

	const toHex = (value: number) => {
		const hex = Math.round((value + m) * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Helper method to calculate contrasting text color (black or white)
function getContrastingTextColor(hexColor: string): string {
	// Convert hex to RGB
	const r = parseInt(hexColor.slice(1, 3), 16);
	const g = parseInt(hexColor.slice(3, 5), 16);
	const b = parseInt(hexColor.slice(5, 7), 16);

	// Calculate relative luminance using WCAG formula
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	// Return black for light backgrounds, white for dark backgrounds
	return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export {generateDistinctColor, getContrastingTextColor}