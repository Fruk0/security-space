# Security Space (MVP)

Portal interno para intake de seguridad y scoring de riesgo vinculado a tickets de Jira.

## Stack
- Next.js (App Router) + React + TypeScript
- Tailwind + shadcn/ui
- Estado local (useState/useMemo)

## Scripts
- `npm run dev` — entorno local
- `npm run build` — build de producción
- `npm run start` — servir build

## Flujo resumido
1. Confirmar ticket (regex Jira `^[A-Z]{1,4}-\\d+$`)
2. (Opcional) Criterios rápidos → si pasa, listo.
3. Si no pasa → Framework de riesgo (14 preguntas), score/level y comentario para Jira.

## Notas
- No se suben archivos `.env*`
- No se sube `node_modules/`
