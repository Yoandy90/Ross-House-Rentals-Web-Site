# Sistema de Candado - Feature Flags para App Store

## Archivos incluidos:

1. **hooks/useFeatureFlags.ts** - Hook para verificar flags
2. **app/_adminScreens/feature-flags.tsx** - Pantalla de admin
3. **app/(tabs)/_layout.tsx** - Layout modificado (oculta tab de Juegos)
4. **app/(admin)/more.tsx** - Menú admin con enlace a Control Juegos

## Instrucciones:

1. Copia `hooks/useFeatureFlags.ts` a tu carpeta `frontend/hooks/`
2. Copia `app/_adminScreens/feature-flags.tsx` a `frontend/app/_adminScreens/`
3. Reemplaza `app/(tabs)/_layout.tsx` en `frontend/app/(tabs)/`
4. Reemplaza `app/(admin)/more.tsx` en `frontend/app/(admin)/`

## Cómo usar:

- Ve a: Admin → Más Opciones → Sistema → Control Juegos
- Por defecto TODO está DESACTIVADO (cumple App Store)
- Puedes activar/desactivar cuando quieras
