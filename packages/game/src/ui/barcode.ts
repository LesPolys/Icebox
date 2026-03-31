/**
 * Code 128B barcode encoder.
 * Returns alternating bar/space widths for rendering.
 */

// Code 128B patterns (values 0-106), each is 6 digits (bar,space,bar,space,bar,space)
// Encoded as strings for compactness and reliability.
const PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131",
  // 103: Stop/reverse stop (unused directly)
  "211412",
  // 104: Start Code B
  "211214",
  // 105: Start Code C (unused)
  "211232",
];

const STOP_PATTERN = "2331112"; // 7-width stop symbol
const START_B = 104;

/**
 * Encode a text string as Code 128B barcode.
 * Returns alternating bar/space widths (starts with a bar).
 */
export function encodeCode128B(text: string): number[] {
  const values: number[] = [START_B];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const value = code - 32; // Code 128B: ASCII 32-127 → values 0-95
    if (value < 0 || value > 95) continue;
    values.push(value);
  }

  // Checksum: start value + sum(position * value)
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  values.push(checksum % 103);

  // Convert to bar/space widths
  const widths: number[] = [];
  for (const val of values) {
    const pattern = PATTERNS[val];
    for (const ch of pattern) {
      widths.push(parseInt(ch, 10));
    }
  }

  // Stop pattern (7 widths)
  for (const ch of STOP_PATTERN) {
    widths.push(parseInt(ch, 10));
  }

  return widths;
}
