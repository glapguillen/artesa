# ARTESA · Planta Viva

Gemelo digital ligero de la planta ARTESA (Cuenca): plano 2D, diagrama del flujograma oficial y KPIs.
Stack: Vite + React 19 (<19.4, por R3F) + TypeScript estricto + zustand + Tailwind v4 + @xyflow/react + recharts + zod. El 3D (React Three Fiber) llega en la Fase 2.

## Reglas
- Fuente única de verdad: `public/plant-layout.json`, validado por `src/domain/schema.ts` y `src/domain/validate.ts`. Cambiar el layout o el proceso se hace en el JSON, no en el código.
- No inventes medidas, cantidades ni equipos: usa `null` en el JSON y muestra `POR_DEFINIR` (`src/ui/tokens.ts`). Registra lo pendiente en `docs/datos-faltantes.md`.
- Las vistas no calculan KPIs de negocio: llegan calculados en `LiveState` (`src/domain/live.ts`) desde una `DataSource`. Solo se permite agregación de presentación (p. ej. el peor estado de una zona en `src/domain/selectors.ts`).
- Un id sin datos en vivo se muestra en gris ("Sin datos") y nunca rompe la app (`noUncheckedIndexedAccess` está activo).
- Componentes de menos de 200 líneas y sin lógica de datos; el estado global vive en `src/store/usePlantStore.ts`.
- UI en español, modo claro y oscuro con las variables de `src/index.css` (`var(--c-…)` o clases `bg-surface`, `text-tenue`, `border-borde`…), usable desde 360 px de ancho.
- Solo dependencias MIT/Apache/BSD/ISC/CC0 en lo que se publica; nada AGPL (lightningcss, MPL-2.0, es solo de compilación). Los assets 3D llevan su licencia en `public/models/LICENSES.md`.
- El repositorio es público: nunca versiones datos personales (nombres, cédulas, correos, teléfonos, salarios). La nómina entra solo agregada en `personal.dotacion`.
- Credenciales y URLs privadas en `.env` (no versionado).
- Antes de dar algo por terminado: `npm run typecheck && npm run lint && npm test && npm run build`.
