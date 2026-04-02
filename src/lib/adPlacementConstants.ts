/**
 * Canonical placement keys shared by native AdMob routing and the ad_placements table.
 */

export const MAIN_APP_BOTTOM_BANNER_PLACEMENT = 'main_app_bottom_banner';

/**
 * Full-screen surfaces (music / album / playlist / daily mix / loops video, etc.) use bottom
 * banners keyed with a `_bottom_banner` suffix. The main tab banner is the exception — it must not
 * be treated as an immersive-player-owned surface for hide/remove guards.
 */
export function isFullScreenPlayerBottomBannerKey(placementKey: string | undefined): boolean {
  if (!placementKey) return false;
  return placementKey !== MAIN_APP_BOTTOM_BANNER_PLACEMENT && /_bottom_banner$/.test(placementKey);
}

/**
 * When a modal replaces the banner slot on top of a player, we stash the previous native banner
 * params and restore them on dismiss. Keys should end with `_modal_bottom_banner` (or contain
 * that segment before the end) so they stay distinct from player / main placements.
 */
export function isOverlayModalBannerPlacementKey(placementKey: string | undefined): boolean {
  if (!placementKey) return false;
  return /_modal_bottom_banner$/.test(placementKey);
}
