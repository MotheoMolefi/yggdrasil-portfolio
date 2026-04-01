import { GALAXY_SKYBOX_FILES } from './galaxySkybox'

/** Cubemap faces — preload in root layout so the browser fetches before Scene mounts. */
export const PRELOAD_SKYBOX_IMAGES: readonly string[] = [...GALAXY_SKYBOX_FILES]

/** Tree GLBs that gate leaving the loader — same URLs as `Scene` critical load. */
export const PRELOAD_SCENE_GLBS = [
  '/Yggdrasil_Tree_GoodBake1.glb',
  '/Yggdrasil_Tree_MetallicLook.glb',
] as const

/** Welcome particle title — `LoadingParticles` FontLoader. */
export const PRELOAD_WELCOME_FONT_JSON = '/norse_font/Norsebold.json'
