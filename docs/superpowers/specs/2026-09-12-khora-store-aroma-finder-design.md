# KHORA Tienda: Encontrá tu aroma y Perfil Sensorial público

## Estado

Diseño aprobado para planificación. Esta especificación no implementa código ni modifica la lógica de carrito, reservas, pedidos o Administración.

## Propósito

Convertir los perfiles sensoriales ya administrados en KHORA Administración en una experiencia pública de descubrimiento dentro de KHORA Tienda. La persona podrá responder cuatro preguntas, recibir recomendaciones explicables y ver el perfil sensorial editorial de cada producto.

La propuesta debe conservar la identidad visual de KHORA: fondo crema, verde oscuro, tipografía editorial, animaciones discretas y composición amplia. No debe parecer un formulario administrativo ni introducir información sensorial distinta a la cargada en Administración.

## Alcance

### Incluido

- Una vista pública independiente en `/tienda?vista=aroma`.
- Acceso desde un nuevo ítem `ENCONTRÁ TU AROMA` del header y un CTA editorial en el inicio de Tienda.
- Cuestionario de cuatro respuestas: sensación, lugar, familia aromática e intensidad.
- Recomendaciones ordenadas usando datos sensoriales estructurados existentes.
- Las tres mejores recomendaciones inicialmente, más una acción para ver el resto si existe.
- Un bloque público `PERFIL SENSORIAL` en la ficha de producto.
- Diseño responsive: panel amplio en desktop y pregunta por paso en mobile.
- Tests de matching, límites de acceso a datos, disponibilidad y renderizado condicional.

### Excluido

- IA, generación automática de textos o inferencias no respaldadas por datos.
- Guía de aromas.
- Reescritura del buscador.
- Cambios a carrito, reservas de stock, WhatsApp, pedidos, autenticación, mayorista, colecciones o Administración.
- Mostrar notas privadas, datos internos o perfiles no publicados.

## Recorrido público

1. La persona selecciona `ENCONTRÁ TU AROMA` desde el header o el CTA del inicio.
2. La Tienda pasa a `vista=aroma` sin carga completa, manteniendo el header y el lenguaje visual vigente.
3. Una introducción editorial explica: “Respondé unas simples preguntas y descubrí los aromas ideales para tu espacio y tu estilo.”
4. El cuestionario pide, en este orden, sensación, lugar, familia aromática e intensidad.
5. En desktop se muestra un panel cómodo con progreso visible; en mobile se muestra una pregunta por vez y controles táctiles claros para avanzar o volver.
6. Al elegir las cuatro respuestas, `VER RECOMENDACIONES` reemplaza el cuestionario por `Tus aromas ideales` en la misma vista.
7. Cada resultado permite abrir su ficha pública o agregarlo a la bolsa con los handlers existentes.
8. `Cambiar respuestas` conserva la experiencia y permite recalcular; `Volver a la tienda` regresa al catálogo vigente.

## Datos públicos y privacidad

La Tienda seguirá consumiendo el catálogo mediante `GET /api/tienda?entity=products`, cuya consulta actual ya es la fuente central de producto activo, publicación en Tienda, precio y disponibilidad. Esa misma consulta se ampliará con una proyección pública del perfil sensorial, exclusivamente desde:

- `public.sensory_options` para `id`, `kind`, `slug`, `label` y orden.
- `public.product_sensory_options` para las asociaciones de cada producto.

La consulta solo expondrá opciones sensoriales activas asociadas al producto. No expone `code_base.description`, porque es la fuente de notas privadas. La descripción pública seguirá proviniendo de `products.store_description`.

El recomendador trabaja únicamente con los productos que ya llegaron desde el catálogo central y tienen `availableStock > 0`. De este modo conserva las reglas actuales de producto activo, publicado, precio válido, reservas temporales y stock disponible. Los productos sin perfil sensorial permanecen en el catálogo normal, pero no aparecen en recomendaciones.

## Compatibilidad

El módulo puro `calculateAromaMatch(product, answers)` recibe un perfil público y cuatro respuestas. Cada coincidencia vale un punto:

| Coincidencia | Puntos |
| --- | ---: |
| Sensación | 1 |
| Lugar | 1 |
| Familia aromática | 1 |
| Intensidad | 1 |

La función devuelve un entero de 0 a 4 y una etiqueta, no porcentajes artificiales:

- 4: `Excelente compatibilidad`
- 3: `Muy buena compatibilidad`
- 2: `Buena compatibilidad`
- 1: `Compatibilidad baja`
- 0: no se muestra como recomendación

Los resultados se ordenan por score descendente. Los empates conservan el orden estable del catálogo; no se inventan desempates comerciales. Si no hay matches, se muestra un estado editorial con la acción `Cambiar respuestas`.

## Ficha de producto

`ProductDetail` reemplaza el bloque aislado de “Materiales y cuidado” por un bloque editorial `PERFIL SENSORIAL` cuando el producto posee información pública. Los grupos sin valores se omiten por completo. El orden es:

1. Familia aromática.
2. Notas principales.
3. Sensación.
4. Intensidad, con puntos y etiqueta accesible `Suave`, `Media` o `Intensa`.
5. Ideal para.
6. Momento.
7. Descripción pública al final.

Si el producto no tiene perfil, se mantiene el fallback actual de cuidado/descripción sin campos vacíos ni mensajes técnicos.

## Componentes y responsabilidades

- `app/khora-aroma-match.ts`: tipos públicos, normalización de perfil y scoring puro, sin React ni acceso a red.
- `app/khora-aroma-finder.tsx`: estado del cuestionario, controles de progreso, resultados y callbacks existentes de abrir/agregar producto.
- `app/khora-sensory-display.tsx`: presentación editorial del perfil en fichas y tarjetas de recomendación, ocultando grupos vacíos.
- `app/api/tienda/route.ts`: proyección pública y segura del perfil sensorial al catálogo; no genera datos ni cambia reglas de disponibilidad.
- `app/tienda/page.tsx`: incorpora la vista `aroma`, el ruteo por query string y las entradas desde header/inicio.
- `app/tienda/store.module.css`: estilos CSS Modules, breakpoints y animaciones de baja intensidad.

## Manejo de errores y estados

- Si el catálogo no carga, se usa el estado de error y reintento existente de Tienda.
- Si no existen perfiles compatibles, se muestra un estado vacío útil, sin recomendar productos por azar.
- El botón de agregar usa el flujo de reserva existente y permanece deshabilitado mientras esa operación está procesando.
- El cuestionario es opcional: no altera catálogo, búsqueda, carrito ni estado de reserva cuando se abandona.

## Verificación

- Tests unitarios de 0–4 coincidencias, orden y etiquetas.
- Tests de API que prueban que solo se proyecta perfil sensorial activo y no notas privadas.
- Tests de UI para grupos condicionales, resultados, CTA y ausencia de perfiles vacíos.
- Validación de que el matching considera solo productos con disponibilidad positiva y la consulta central conserva sus reglas de publicación.
- Build, lint y suite completa existentes.
- Revisión visual en desktop y mobile, incluido ausencia de scroll horizontal en el cuestionario, resultados y ficha.
