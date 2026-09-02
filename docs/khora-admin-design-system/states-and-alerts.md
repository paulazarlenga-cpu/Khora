# Estados y alertas

## Tonos semánticos

En `app/khora-data.ts`, `Tone` es `success | warning | danger | info | neutral`. `Badge`, `Metric` y varios paneles consumen estos tonos. La semántica es:

| Tono | Significado Admin | Ejemplos |
| --- | --- | --- |
| success | correcto, disponible, activo | stock disponible, proveedor activo |
| warning | requiere seguimiento | poco stock, pago pendiente |
| danger | crítico, error o destructivo | agotado, sin stock, eliminar |
| info | dato orientativo | información de trazabilidad |
| neutral | sin clasificación o inactivo | nuevo, estándar |

Un estado siempre combina punto/color con texto y, cuando corresponde, unidad o acción. No usar rojo para llamar la atención de forma genérica.

## Stock

Los helpers de dominio (`getStockStatus`, `materialStockStatus` y equivalentes) traducen cantidad y mínimo a normal/disponible, bajo/poco stock o agotado/crítico. La UI debe mostrar cantidad actual, mínimo y unidad cerca del badge. Mezclas, productos terminados y materias primas pueden compartir semántica, pero no asumir que tienen la misma fórmula de cálculo.

## Centro de operaciones y notificaciones

`getOperationalOverview` calcula asuntos a partir de datos actuales. El dashboard los presenta en columnas de prioridad y `NotificationCenter` agrupa alertas `critical`, `attention` e `information`. Cada alerta tiene label, título, detalle, acción y destino; el usuario debe poder llegar a la entidad que origina el asunto. Los badges de navbar/tab (`nav-alert`, `tab-alert-badge`) son contadores de apoyo, no reemplazan el detalle.

“3 asuntos para revisar” es un resumen derivado, no una entidad nueva. Si cambian stocks, pagos u operaciones, el contador debe actualizarse desde la misma fuente y no mediante un número manual.

## Estados de controles

Todo control nuevo debe considerar:

- **Normal:** contraste y affordance claros.
- **Hover:** cambio sutil de fondo/borde o color; no desplazar layout.
- **Pressed:** presión breve (`--motion-press`) o cambio de superficie.
- **Focus-visible:** anillo visible, no eliminado por reset.
- **Loading:** texto/indicador estable, `aria-busy`, sin doble envío.
- **Disabled:** no accionable, contraste suficiente para entender el motivo.
- **Error:** mensaje cercano, `aria-invalid` y corrección sugerida.

`Button` centraliza buena parte del contrato; los botones históricos requieren revisión individual antes de reutilizarse.

## Estados de contenido

- **Actualizando:** el código usa subtítulos como “Actualizando…” y loading de botón; conservar el contexto visible.
- **Vacío:** explicar qué falta y ofrecer una próxima acción cuando exista.
- **Error de datos:** indicar que no se pudo cargar/guardar y permitir reintentar sin perder el formulario.
- **Sin permiso:** no simular vacío; explicar que el acceso está restringido.

No existe un skeleton global ni un componente universal de error. Mantener un patrón consistente por familia hasta que se haga una unificación explícita.

## Destructivas y reversibles

Eliminar, cancelar o anular debe usar tono danger, confirmación y verbo concreto. Una reversión de venta/compra/fabricación debe comunicar que corrige un movimiento y no confundirla con borrar historial. El texto de la alerta debe reflejar el comportamiento real del dominio.

## Accesibilidad

No depender solo de color, tamaño o posición. Los contadores deben tener nombre accesible, icon-only debe incluir label, dialogs deben exponer `role=dialog`, y la alerta debe leerse en orden lógico. Respetar foco visible y navegación por teclado.
