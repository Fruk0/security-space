# Security Space – README

Una guía rápida de cómo está organizado el MVP, qué hace hoy y cómo crecer sin romper nada. Pensado para Next.js (App Router) + shadcn/ui.

<img width="975" height="460" alt="image" src="https://github.com/user-attachments/assets/8ba27788-a004-46aa-8ac2-4b0fbf189f97" />


---

## 1) ¿Qué es esto?

Un **orquestador** de intake de seguridad que permite:

* Validar un **ticket de Jira** (KEY con regex).
* Intentar pasar por **criterios rápidos** (C1..C4).

  * Si un criterio aplica y todas sus respuestas son “Aplica” con **justificación** → **PASA**.
* Si no pasa por criterios → **Framework de riesgo** con 14 preguntas, **score** y **nivel** (Low/Medium/High).
* **Copiar** un **payload JSON** y un **comentario listo** para pegar en Jira.
* Sticky de score / progreso cuando se usa el framework.

> Estado actual: **MVP local**, sin backend, sin auth, sin Jira API. Todo client-side.

---

## 2) Estructura de carpetas

```txt
.
├─ app/
│  └─ home/
│     └─ page.tsx                # Pantalla principal (UI y orquestación del flujo)
│
├─ lib/
│  └─ security/
│     ├─ scoring.ts              # Helpers de evaluación/score/nivel y builders de payload/comentario
│     ├─ clipboard.ts            # writeClipboard() con fallback seguro
│     └─ jira.ts                 # Regex de Jira y helpers de validación
│
├─ policy/
│  └─ security/
│     ├─ criteria-groups.json    # Metadatos de criterios (C1..C4: título + descripción)
│     ├─ criterion-questions.json# Preguntas por criterio (id, group, text)
│     └─ framework-questions.json# Preguntas del marco de riesgo (id, texto, peso, riskWhen, etc.)
│
└─ components/ui/…               # shadcn/ui (Button, Card, Badge, etc.)
```

> Si usás `src/`, mové `lib/` y `policy/` dentro de `src/` y asegurate de que el alias `@` apunte correctamente.

---

¡hecho! acá tienes el **punto 3** listo para **reemplazar 1:1** en tu README.

---

### 3) Cómo levantar el proyecto **desde GitHub** (privado o público)

**Requisitos**

* Node.js **18+**
* npm (v9+)
* Acceso al repo (si es **privado**: usa **SSH** con tu clave agregada a GitHub o **HTTPS** con un **PAT**)

**A. Clonar el repositorio**

> **SSH (recomendado)**

```bash
git clone git@github.com:<tu-org-o-user>/<tu-repo>.git security-space
```

> **HTTPS (alternativa)**

```bash
git clone https://github.com/<tu-org-o-user>/<tu-repo>.git security-space
```

**B. Instalar dependencias**

```bash
cd security-space
npm i
```

**C. Verificar configuración de TypeScript (alias `@`)**
Asegurate que `tsconfig.json` contenga:

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] },
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

> Si usás `src/`, revisá que el alias `@` apunte a `./src/*` y que las carpetas (`lib/`, `policy/`) estén dentro de `src/`.

**D. Ejecutar en local (dev)**

```bash
npm run dev
```

Abrí: `http://localhost:3000/home`

**E. Build & producción (opcional)**

```bash
npm run build
npm run start
```

**F. (Privado) Agregar colaboradores**

* En GitHub → *Settings* → *Collaborators & Teams* → **Add people** (o **Teams**).
* Si usan SSH: cada dev debe agregar su **SSH key** en GitHub (*Settings* → *SSH and GPG keys*).

**G. (Opcional) Despliegue rápido en Vercel**

1. Crea un proyecto en Vercel y conéctalo al repo de GitHub.
2. Framework: **Next.js** (auto-detectado).
3. Variables de entorno: este MVP **no necesita**.
4. Deploy.

**Notas**

* shadcn/ui ya está incluido en el repo (no hay pasos extra).
* El flujo usa **portapapeles** con *fallback*; en navegadores con restricciones el prompt de copia manual aparecerá automáticamente.
* Si cambiás la ruta principal, hoy está en `/home` (Next.js App Router). Si querés `/security-space`, renombrá la carpeta a `app/security-space/page.tsx` o crea una ruta adicional.

---

## 4) Flujo funcional (resumen)

1. **Ingresás KEY de Jira** → validación con `/^[A-Z]{1,4}-\d+$/`.
2. **Confirmás ticket**.
3. Elegís:

   * **Criterios (opcional)**

     * Seleccionás C1..C4 → respondés **Aplica/No aplica/Duda**.
     * Si marcás **Aplica** en alguna pregunta → **justificación obligatoria**.
     * Si **todas** las preguntas del criterio son “Aplica” **con** justificación → botón **Aceptar por criterio** → **PASA**.
   * **Framework de riesgo**

     * Si “No aplica / Ir al framework” o si el criterio **no pasa**.
     * Debés responder **todas** las preguntas (Sí/No/No sé).
     * Se calcula **score** y **nivel** (Low/Medium/High).
     * Sticky flotante con score y **progreso**.
4. **Acciones (cuando hay decisión válida)**

   * **Copiar payload JSON** (para futuras integraciones).
   * **Copiar comentario Jira** (mensaje listo).

---

## 5) ¿Qué hace cada módulo?

### `policy/security/*.json`

* **criteria-groups.json**:
  Define cada criterio (C1..C4) con `key`, `title`, `description`.

  > Para agregar un C5, solo añadilo acá y en `criterion-questions.json`.
* **criterion-questions.json**:
  Lista todas las preguntas por criterio: `{ "id", "group", "text" }`.

  > El **motor** asume que un criterio **PASA** si **todas** sus preguntas están en “Aplica” y cada una tiene justificación.
* **framework-questions.json**:
  Lista del framework: `{ id, text, weight, riskType, riskWhen }`.

  * `riskWhen`: `"yes" | "no" | "unknown" | "yes_or_unknown" | "no_or_unknown"`.

### `lib/security/scoring.ts`

* Helpers **puros** (sin React) para:

  * `shouldCount(riskWhen, answer)`
  * `computeScore(answers, questions)`, `computeLevel(score, levels)`
  * `evalSingleCriterion(answers, groupQuestions)`
  * `buildPayload(...)`, `buildJiraComment(...)`
* **Ventaja**: Podés testearlos con unit tests sin montar la UI.

### `lib/security/clipboard.ts`

* `writeClipboard(text)` con fallback:

  * Usa `navigator.clipboard` si el contexto es seguro.
  * Si falla, usa `document.execCommand('copy')`.
  * Si falla, muestra `window.prompt` para copiar manualmente.

### `lib/security/jira.ts`

* `JIRA_KEY_RE` y `isJiraKeyValid(key: string)`.

### `app/home/page.tsx`

* Orquesta todo:

  * Estados locales (key, criterios, framework, sticky, copias).
  * Renderiza tarjetas y botones.
  * Habilita acciones solo cuando la decisión está lista:

    * **Por criterio**: criterio aceptado.
    * **Por framework**: todas las preguntas respondidas.

---

## 6) Cómo **agregar** un nuevo criterio (ej. C5 – Compliance)

1. Editá `policy/security/criteria-groups.json` e **insertá**:

   ```json
   {
     "key": "C5",
     "title": "Criterio 5 – Cumplimiento/Compliance",
     "description": "Condiciones de cumplimiento regulatorio sin afectación de datos sensibles ni cambios en lógica."
   }
   ```
2. En `policy/security/criterion-questions.json` **agregá** las preguntas del grupo `"group": "C5"`.
3. **Listo** 🎉. La UI cargará automáticamente el nuevo criterio como tarjeta.

   * El motor ya sabe: **PASA** si todas las preguntas del grupo están en “Aplica” + justificación.

> Si querés custom rules por criterio (ej. “al menos 3/4”), podrías extender `scoring.ts` (p. ej. `evalCriterionBy(group, mode: 'all' | 'atLeastN', n?: number)`), y guardar ese `mode`/`n` en `criteria-groups.json`.

---

## 7) Cómo **agregar** preguntas al framework

* Solo editá `policy/security/framework-questions.json`.
* Respetá los campos y el `riskWhen`.
* El sticky/progreso y el gating de “todas respondidas” funcionan automáticamente.

---

## 8) Validación de Jira (regex)

* **Regex**: `^[A-Z]{1,4}-\d+$` (máx 4 letras, guión y número).
* Si necesitás series de letras más largas (ej. 5–10), cambiá en `jira.ts`.

---

## 9) Copiar al portapapeles

* Usamos `writeClipboard()` con **fallbacks**.
* Estados `copiedJSON`/`copiedComment` cambian temporalmente el texto del botón (“Copiado / Error ❌”).

---

## 10) Accesibilidad & UX

* Sticky flotante discreto con score, nivel y progreso (solo en framework).
* Mensajes de estado claros (“Pendiente”, “Aceptado”, “Riesgo temporal/final”).
* Inputs con error states (regex Jira) y **justificación obligatoria** solo cuando **Aplica**.

---

## 11) Roadmap técnico (resumido)

* **Fase 1 – MVP** (actual):

  * Flujo local, sin persistencia ni auth.
  * Copiado JSON/Comentario.
* **Fase 2 – API & Jira**:

  * Backend **FastAPI**:

    * `/api/jira/validate`, `/api/jira/update` (labels, risk score/level, comment).
  * **SSO OIDC** (NextAuth con OIDC).
  * Persistencia mínima (ticket\_key, respuestas, score\_final, nivel, autor, timestamp).
  * Auditoría (bitácora de acciones).
* **Fase 3 – Dashboards**:

  * Métricas por squad/tribu (No aplica %, promedio Risk Score, High vs Low, TTR).
  * Export/CSV y vistas comparativas.
* **Fase 4 – Hub**:

  * Integraciones DevSecOps (SAST/DAST/SCA) y “single pane of glass”.
  * Extensibilidad de **criterios** (Negocio/Compliance) y cálculo de **WSJF de seguridad** (cuando lo definas).
  * Perfiles y permisos (RBAC), features gamification.

---

## 12) Buenas prácticas / Siguientes pasos

* **Seguridad**:

  * No exponer tokens de Jira en el cliente. Lógico del lado servidor (Next API routes o FastAPI).
  * Secretos en **Vault** / **.env** server-only.
  * Logging de auditoría (quién, qué, cuándo) → crucial para “responsabilidad”.
* **Tests**:

  * Unit tests en `lib/security/scoring.ts` (puro, fácil de testear).
  * E2E (Playwright) para el flujo completo.
* **Observabilidad**:

  * Medir adopción (cuántos tickets pasan por criterio, % que van a framework, tiempos).
* **Escalabilidad de políticas**:

  * Mantener **TODO el contenido** fuera del componente (en `policy/`).
  * Documentar criterios (propósito, cuándo usarlo, ejemplos).

---

## 13) Ejemplos útiles

### Payload JSON (por criterio)

```json
{
  "ticket": "CS-123",
  "decision": {
    "mode": "criterion",
    "byCriterion": {
      "used": "C1",
      "title": "Criterio 1 – PATCH en servicio previamente validado",
      "answers": { "c1_q1": "yes", "c1_q2": "yes", "...": "yes" },
      "justifications": { "c1_q1": "patch 1.2.3→1.2.4", "c1_q2": "sin cambios en contratos", "...": "..." }
    },
    "byFramework": null
  },
  "notes": "Observaciones…",
  "rationale": [],
  "generatedAt": "2025-08-20T15:30:00.000Z"
}
```

### Comentario para Jira (por framework)

```
Solicito registrar el **Security Risk** calculado.
Nivel: **Medium** (8 pts).
Todas las preguntas del framework fueron respondidas.

Respuestas que aportan riesgo:
- ¿Procesa o expone datos sensibles…? (+3)
  Respuesta: yes
- ¿Afecta control de roles…? (+2)
  Respuesta: yes
…
Notas: …
```

---

## 14) ¿Cómo agrego otra pantalla (ej. KPIs)?

* Creá `app/kpi/page.tsx` y usá los mismos componentes de UI.
* Podés leer tus datos de la futura API o mockear con JSON y `policy/`.

---
