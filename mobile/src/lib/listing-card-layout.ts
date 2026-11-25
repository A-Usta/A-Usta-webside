/** Match the two-column marketplace grid at the supported compact phone widths. */
export function listingCardWidth(viewportWidth: number, horizontalPadding = 12, columnGap = 10): number {
  const available = Math.max(0, viewportWidth - horizontalPadding * 2 - columnGap);
  return Math.floor(available / 2);
}
