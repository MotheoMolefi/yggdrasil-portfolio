# Norse font for loading-screen particles

The loading particle effect can render the word **Yggdrasil** in 3D using the **Norse Bold** font. Three.js cannot load `.otf` files directly; it needs a **typeface JSON** file.

## Get `Norsebold.json`

1. Go to **[facetype.js](https://gero3.github.io/facetype.js/)** (or [Vextrude font converter](https://vextrude.com/font_converter)).
2. Upload `Norsebold.otf` from this folder.
3. Download the generated `.json` file.
4. Save it here as **`Norsebold.json`** (same folder as this README).
5. Ensure the file is served from `/norse_font/Norsebold.json` (e.g. put it in `public/norse_font/Norsebold.json` if your app serves from `public/`).

If the JSON is missing or the font fails to load, the loading screen falls back to a **sphere** of particles instead of text.
