# Tipografías de marca

## Montserrat (texto / cuerpo)
Se instala automáticamente vía `@fontsource/montserrat` (ver `src/main.tsx`).
No hay que hacer nada.

## Dunkerque (títulos, subtítulos y logo)
Es una fuente propia de la marca. Cuando tengas el archivo, dejalo en esta
carpeta con **exactamente** uno de estos nombres (en orden de preferencia):

- `Dunkerque.woff2`  ← formato recomendado (más liviano)
- `Dunkerque.woff`
- `Dunkerque.otf`
- `Dunkerque.ttf`

En cuanto el archivo esté acá, los títulos y el logo del sistema pasan a usar
Dunkerque automáticamente (la regla `@font-face` ya está definida en
`src/styles/fonts.css`). Mientras tanto, el diseño usa Montserrat en negrita
como sustituto para no romperse.

> Si tu archivo viene en `.otf`/`.ttf`, funciona igual; si querés que cargue más
> rápido, se puede convertir a `.woff2` sin perder calidad.
