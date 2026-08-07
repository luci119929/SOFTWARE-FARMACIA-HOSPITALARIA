// Logotipo MEDLĪNE. Usa la tipografía de marca Dunkerque (con Montserrat como
// sustituto hasta cargar el archivo de fuente). La "Ī" lleva macrón, como en el
// logo original.
export function Wordmark({ size = 22, color = 'var(--brand-mint)' }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.03em',
        color,
        lineHeight: 1,
        textTransform: 'uppercase',
        userSelect: 'none',
      }}
    >
      MEDLĪNE
    </span>
  );
}
