# Design tokens

Los tokens son decisiones semánticas, no una invitación a reemplazar valores a ciegas. La tabla “oficial para nuevas piezas” expresa el lenguaje que debe seguir KHORA Admin; la tabla de implementación permite encontrar lo que ya existe. En esta entrega no se hace una sustitución global.

## Color oficial para nuevas piezas

| Token | Valor | Intención |
| --- | --- | --- |
| `brand-primary` | `#174D3A` | navbar y acción primaria |
| `brand-secondary` | `#2F6B52` | hover/éxito verde |
| `brand-accent` | `#C6A15B` | acento dorado |
| `background` | `#F8F7F3` | canvas de Admin |
| `surface` | `#FFFFFF` | panel, card, drawer |
| `surface-soft` | `#F2F3EF` | fila, control o superficie secundaria |
| `text-primary` | `#202420` | texto principal |
| `text-secondary` | `#66706A` | texto auxiliar |
| `border` | `#E4E4DE` | separador y borde |
| `green-soft` | `#E7EFEA` | fondo de éxito/disponible |
| `success` | `#2F6B52` | confirmado, disponible |
| `warning` | `#D39A35` | atención, poco stock |
| `warning-soft` | `#FFF4D9` | fondo de warning |
| `danger` | `#B84A4A` | error, crítico, destructivo |
| `danger-soft` | `#FBE9E9` | fondo de peligro |
| `info` | `#55778A` | información |
| `info-soft` | `#EAF1F4` | fondo informativo |

## Correspondencia con `app/globals.css`

La identidad está representada directamente por `--khora-green`, `--khora-green-secondary`, `--khora-cream`, `--khora-white`, `--khora-ink` y `--khora-gold`. También existen aliases de una generación anterior:

| Semántica | Token actual frecuente | Valor actual | Observación |
| --- | --- | --- | --- |
| primary | `--forest` / `--button-primary-bg` | `#173F35` / `#173F35` | cercano, no idéntico a `#174D3A` |
| secondary | `--forest-2` / `--button-primary-hover` | `#245548` | alias histórico |
| background | `--cream` | `#F7F5F0` | distinto de cream oficial |
| text | `--ink` | `#21332D` | distinto del ink oficial |
| border | `--line`, `--button-utility-border` | `#E5E8E2`, `#E1E5E1` | hay más de un borde |
| warning | `--amber` | `#C99136` | funcional; la semántica nueva propone `#D39A35` |
| danger | `--red` | `#B74F45` | funcional; la semántica nueva propone `#B84A4A` |
| info | `--blue` | `#4D7C78` | teal actual |
| secondary button text | `--button-secondary-text` | `#285887` | azul heredado, no verde oficial |

Consultar el selector concreto antes de cambiar un token: algunos aliases posteriores sobrescriben reglas antiguas. La existencia de la variable no garantiza que todo el producto la use de forma uniforme.

## Tipografía y escalas

| Token conceptual | Valor |
| --- | --- |
| `font-body` | Inter/system sans |
| `font-display` | Georgia para headings y valores editoriales |
| `text-meta` | `.75rem` |
| `text-small` | `.8125rem` |
| `text-body` | `.9375rem` |
| `text-nav` | `.875rem` |
| `text-section` | `1.375rem` |
| `text-value` | `1.875rem` |
| dashboard value recomendado | `28–32px` |

Para nuevas pantallas, mantener contraste sans/serif y revisar la escala conceptual de [foundations.md](foundations.md) antes de introducir un tamaño puntual.

## Espaciado y forma

| Token | Valor |
| --- | --- |
| `space-xs` | 4px |
| `space-sm` | 8px |
| `space-md` | 12px |
| `space-base` | 16px |
| `space-lg` | 24px |
| `space-xl` | 32px |
| `space-2xl` | 48px |
| `space-3xl` | 64px |
| control/input | 40–44px de alto |
| `radius-control` | 9–10px |
| `radius-card` | 13–16px |
| `radius-dropdown` | 12px |
| `radius-pill` | 999px |
| borde | 1px solid `#E4E4DE` (objetivo) |
| sombra ligera | `0 2px 8px rgba(32,36,32,.05)` (objetivo) |

El CSS existente usa radios 8/9/11/13/16 y sombras de mayor alcance. Reutilizar la clase del componente en lugar de copiar un valor nuevo.

## Motion y foco

Los tokens actuales son `--motion-press:110ms`, `--motion-fast:170ms`, `--motion-normal:230ms` y `--ease-standard:cubic-bezier(.2,.75,.25,1)`. Los botones usan una transición de 170 ms y presión de 110 ms. El foco visible usa `--focus-ring:rgba(62,112,91,.22)` y `--focus-border:#6F9584`; conservarlo en controles nuevos.

## Botones

`Button` utiliza estas variables actuales: `--button-primary-*`, `--button-success-*`, `--button-secondary-*`, `--button-neutral-*`, `--button-danger-*` y `--button-utility-*`. Alturas: `xs` 28, `sm` 32, `md` 40, `lg` 48 px; radio base 9 px. Variantes y estados están descritos en [components.md](components.md) y [states-and-alerts.md](states-and-alerts.md).

## Logo

No convertir el logo a texto ni redibujarlo. Usar `KhoraLogo` y los assets de `public/brand/`. ViewBoxes: full 240×170, horizontal 300×76, icon 64×64; favicon 16/32 y app icon 512. Los tamaños responsive vigentes están en [responsive.md](responsive.md).

## Regla de adopción

1. Si un token actual ya resuelve la necesidad, reutilizarlo.
2. Si el valor difiere de la tabla oficial, no corregir globalmente en una tarea local.
3. Para una unificación futura, migrar por familia (color, botones, tipografía), probar todas las rutas y registrar impacto visual.
