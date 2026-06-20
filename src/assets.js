// Optional pre-rendered art / idle video per fighter.
//
// Empty by default — the select screen falls back to a procedural emoji portrait.
// When you generate assets (see docs/ASSETS.md, e.g. with Higgsfield), drop the
// files under assets/fighters/<id>/ and map them here. Example:
//
//   export const ASSETS = {
//     gojo: { art: 'assets/fighters/gojo/portrait.webp', video: 'assets/fighters/gojo/idle.mp4' },
//   };
//
// `video` takes priority over `art`; either is optional.

export const ASSETS = {};

export function assetFor(id) {
  return ASSETS[id] || null;
}
