/** Cubemap face URLs (reference only — not used in `<link rel=preload>`; see `app/layout.tsx`). */
export { GALAXY_SKYBOX_FILES as SKYBOX_FACE_URLS } from './galaxySkybox'

/** Tree GLBs that gate leaving the loader — same URLs as `Scene` critical load. */
export const PRELOAD_SCENE_GLBS = [
  '/Yggdrasil_Tree_GoodBake1.glb',
  '/Yggdrasil_Tree_MetallicLook.glb',
] as const

/** Welcome particle font — loaded only by `FontLoader` in `LoadingParticles` (no `<link rel=preload as=fetch>`; see layout comment). */
export const PRELOAD_WELCOME_FONT_JSON = '/norse_font/Norsebold.json'
