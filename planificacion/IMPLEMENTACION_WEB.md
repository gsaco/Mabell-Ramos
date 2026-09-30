# Mabell Ramos · Implementación y uso de la web

Fecha de revisión: 29 de septiembre de 2026. Referencia: [plan maestro](Plan_maestro_web_consumidores_Mabell_Ramos.md). La web se construye en `gsaco/Mabell-Ramos`; gestión se amplía en `gsaco/Mabell-Ramos-CRM`.

## Estado real de la entrega

La interfaz, el visor, el receptor y el puente con gestión están implementados y comprobados localmente. La interfaz pública se publica desde `main /docs` en [GitHub Pages](https://gsaco.github.io/Mabell-Ramos/). El despliegue del receptor de producción y la actualización de la gestión relacionada son pasos separados. La configuración pública conserva la recepción desactivada hasta conectar el servidor a la bandeja privada y aprobar el aviso de privacidad. El sitio sigue siendo navegable y ofrece Instagram como contacto.

Se respeta la decisión del usuario: **GitHub para la web y los datos, sin números de WhatsApp por ahora**. El Worker previsto en el plan aporta solamente la escritura protegida de formularios. Los datos no se guardan en Cloudflare ni en Supabase; la recepción persistente de producción utiliza GitHub privado. Los límites técnicos de red y antispam sí pertenecen al receptor.

Los seis productos y las seis opciones comerciales previstos en el Draft son trabajo de selección y validación con las emprendedoras. Todavía no hay una exportación aprobada de esos doce registros. La versión actual muestra familias documentadas y el catálogo de referencia; las tarjetas de opciones y agrupaciones se generan cuando existe oferta aprobada. No se publican los ejemplos de prueba.

## Cobertura del plan

| Parte del plan | Implementación y comprobación |
|---|---|
| Inicio y navegación | Productos, Catering y Catálogo visibles, relato de marca, fotografía real de presentación en feria y proceso de consulta en tres pasos. |
| Productos | Fichas individuales separadas de opciones de compra. Cada opción admite piezas, variantes, presentación, precio por unidad de venta, entrega, cambios, estado, enlace estable y formulario desplegable. Se omiten grupos vacíos. |
| Catering | Sólo alimentos, alimentos y servicio o alcance por definir. Personas, fecha, horario e intereses orientan la consulta; no generan una reserva ni un precio por asistente. |
| Catálogo | Las catorce páginas conservan selector, flechas, teclado y ampliación. Los fragmentos anteriores `#pagina-N` siguen abriendo su página. Consulta contextual y lectura HTML complementaria revisada. |
| Identidad y recursos | Morados `#432653` y `#E8DDF2`, crema `#FBF8F4`, Bodoni Moda e Inter locales, logo auténtico y SVG propios. Seis maestros editoriales v2 y cincuenta y siete recursos web responsivos; originales conservados. Ilustraciones identificadas como referenciales; fotografía de mesa identificada como feria. |
| Movimiento | Desplazamientos y respuestas breves, sin carrusel ni decoración que dificulte leer. Respeto de movimiento reducido. |
| Videos | Componente para clips reales autorizados, con poster, controles y carga voluntaria. No se publica un video inexistente. |
| Formularios | Correo, campos opcionales por definir, validación, errores accesibles y recuperación de datos. La constancia requiere comprobar la persistencia; referencia copiable y hora de Lima. Sin JavaScript se conserva lectura y contacto alternativo. |
| Reintentos | Doble clic y pérdida de respuesta conservan ID y contenido. Un envío incierto no permite descartar la identidad. Cambios de precio, unidad o disponibilidad requieren revisión explícita. |
| Recepción privada | Receptor con validación estricta, verificación antispam, límites, CORS, escritura por ID y comprobación independiente del archivo privado. Servidor local con persistencia real, claramente rotulado como local. |
| Gestión | Conexión de lectura separada para la bandeja privada, importación idempotente, avisos en Hoy/Pedidos y detalle del contexto. La consulta no crea automáticamente cliente, venta, cobro, pedido confirmado ni consentimiento promocional. |
| Precios y publicación | En gestión se edita el precio y se revisa la autorización pública. La exportación utiliza campos permitidos; el importador exige nueva versión/revisión cuando cambia una opción. El PDF de referencia no se modifica silenciosamente. |
| SEO y continuidad | Páginas reales, títulos, descripción, canonical, imagen para compartir, sitemap, robots y página 404. Fuente de Pages `main /docs` conservada. |
| Operación y recuperación | Guías de recepción, sincronización, aprobación, fallos y recuperación. La verificación con Mabel y Ana y las conversaciones de OE2 se mantienen como actividades del piloto; no se inventan resultados. |

## Archivos que se editan

| Archivo o carpeta | Qué controla |
|---|---|
| `site-src/content/editorial.json` | Familias de referencia y clips reales aprobados. |
| `site-src/content/catalog-public.json` | Sólo productos y opciones autorizados; nunca el estado privado del CRM. |
| `site-src/content/catalog-pages.json` | Transcripción revisada de las páginas del catálogo. |
| `site-src/content/site-config.json` | Base del sitio, contacto público, endpoint, clave pública antispam y aviso aprobado. No admite credenciales secretas. |
| `site-src/styles/site.css` | Retícula, tipografía, paleta, componentes y movimiento. |
| `site-src/scripts/site.js` | Formularios, constancias, consultas y revisión de cambios. |
| `site-src/catalogue/` | Visor preservado como fuente para construir la sección Catálogo. |
| `tools/build-site.mjs` | Genera las páginas; no elimina los originales de `docs/assets`. |
| `assets-source/` | Maestros e inventario de procedencia de los nuevos recursos. |
| `services/inquiry-receiver/` | Receptor, configuración de servidor y pruebas de persistencia. |
| `docs/` | Resultado público. Los cambios de contenido se hacen en la fuente y después se reconstruye. |

`planificacion/`, `.local-data/`, los transcripts y el Draft no se copian al sitio. Las pruebas de seis opciones viven fuera de `docs`. Los formularios no guardan contactos de forma persistente en el navegador público; el envío pendiente vive en memoria durante el reintento.

## Activación de consultas reales

1. Elegir o crear una bandeja de recepción **privada**, separada del repositorio público y preferiblemente del repositorio de finanzas. Preparar una bandeja privada de prueba antes de aceptar consultas reales.
2. Configurar el receptor con una credencial de escritura limitada a esa bandeja y con los secretos antispam del servidor. Instalar sus secretos siguiendo [la guía del receptor](../services/inquiry-receiver/README.md); no copiarlos al sitio.
3. Mabel y Ana definen responsable, contacto de privacidad, conservación y versión de aviso. Si acuerdan horario/plazo de respuesta, configurar una regla concreta; de otro modo queda pendiente y no se promete un plazo al consumidor.
4. Configurar la conexión de recepción en Gestión con permiso de **lectura** separado. Conservar el escritor operativo para el repositorio privado de gestión. Seguir `Mabell-Ramos-CRM/docs/CONEXION_WEB_CONSUMIDORES.md`.
5. Probar una consulta en la bandeja de prueba, cerrar/reabrir gestión, sincronizar y comprobar que aparece una sola solicitud. Revisar producto, sólo alimentos, catering, alcance por definir y página de catálogo.
6. Publicar el endpoint HTTPS y la clave pública del widget en `site-config.json` sólo después de esa prueba. Reconstruir y revisar antes de enviar los archivos a `main /docs`.

Dos repositorios bajo `gsaco.github.io` comparten el origen del navegador. Para usar gestión con datos reales, configurar dominios de producción distintos, por ejemplo un dominio propio para la web de clientes y otro origen para gestión, conservando ambos repositorios y GitHub Pages. No describir dos rutas del mismo dominio como aislamiento. Actualizar CORS, widget, canonical y enlaces al configurar esos dominios.

Mientras falten estos valores, la interfaz indica que la recepción no está activada y permite consultar por Instagram. No puede enviar una confirmación ficticia. El guardado local de prueba tampoco aparece como recepción de producción.

## Guía cotidiana para Mabel y Ana

### Recibir y continuar una consulta

1. Abrir Gestión, conectar la bandeja privada y sincronizar. Hoy/Pedidos muestra las solicitudes nuevas y sus referencias.
2. Leer contacto, pedido, ocasión declarada, fecha, distrito e intereses. Si hay una opción publicada, revisar su contenido y condiciones en la instantánea recibida. Una página visitada no determina por sí sola el segmento del cliente.
3. Confirmar qué falta con la persona: cantidad, preparación, alcance, capacidad, traslado y precio. Los intereses de montaje o atención son solicitudes, todavía no compromisos.
4. Crear un **borrador** desde la consulta, completar condiciones y confirmar sólo después del acuerdo. Mantener la referencia para evitar copiar o duplicar la solicitud.
5. Tras la entrega, registrar satisfacción y preferencias comunicadas en gestión. El formulario no autoriza campañas ni inscripción automática a promociones.

### Cambiar un precio o pausar una opción

1. En Biblioteca, editar el producto u opción real. Precio, contenido y presentación son distintos de costos internos.
2. Los cambios comerciales requieren otra revisión pública. Para retirar una opción, indicar su estado y revisar la exportación; no borrar su ID por cambiar el nombre.
3. Mabel revisa preparación/atributos; Ana revisa precio/entrega. Ambas autorizan su publicación mediante los controles de gestión.
4. Descargar «Preparar oferta para la web». El mantenedor importa esa exportación con `npm run offer:import -- /ruta/oferta.json`, reconstruye, revisa y publica.
5. Comprobar la opción y su enlace estable en la versión publicada. Si cambió un producto que contiene el paquete, volver a revisar también ese paquete: no basta aprobar sólo el producto. Las consultas guardadas conservan la condición que se recibió; un formulario abierto con revisión anterior debe presentar el cambio antes de reenviar.

### Si algo falla

- **Consulta con referencia recibida:** conservarla y sincronizar; no pedir al cliente que repita el formulario sólo porque gestión no estaba abierta.
- **Recepción incierta:** el visitante reintenta el mismo envío. No se muestra éxito hasta verificarlo y no se cambia su ID mientras siga incierto.
- **Credencial vencida o bandeja no disponible:** renovar/configurar privadamente y sincronizar de nuevo. Informar por el canal acordado; no publicar tokens ni contactos en capturas.
- **Registro inválido:** queda señalado para revisión técnica; no impide importar los demás. Revisar el contrato sin reconstruirlo a partir de datos incompletos.
- **Fallo del sitio:** volver a una versión anterior del contenido público, manteniendo el receptor y la bandeja. Nunca borrar consultas para restaurar el diseño.

## Pruebas y límites de la verificación

La validación combina pruebas de contrato/persistencia, navegador, accesibilidad automática y revisión visual en escritorio/móvil. Cubre entradas inválidas, concurrencia y reintentos, consulta contextual, retirada de opciones, actualización de precio/unidad, teclado, movimiento reducido, contenido sin JavaScript y conservación de medios. Las comprobaciones automáticas de accesibilidad no equivalen a una certificación ni sustituyen una prueba con lector de pantalla.

Resultados al cerrar esta implementación: **47 pruebas de sitio/receptor** aprobadas; **42 casos de navegador** comprobados entre escritorio y móvil, con revisión final de todas las rutas y los catorce enlaces antiguos; **101 pruebas unitarias de gestión**, su compilación y verificaciones de interfaz aprobadas. Los contratos de recepción de los dos repositorios coinciden byte por byte. La simulación de seis opciones, la pérdida de respuesta y los conflictos usan datos ficticios fuera del sitio publicado.

La medición de la primera versión de inicio en Chromium, 390 × 844 px y DPR 3, sin desplazamiento, con latencia de 150 ms y descarga de 1,6 Mbps, registró **738.508 bytes (721 KiB)** antes de recursos voluntarios, CLS 0,076 y LCP 3,57 s. No descargó el PDF. En esa simulación se cumple el presupuesto de 800 KiB y todavía no la aspiración de LCP de 2,5 s. Son medidas de laboratorio con servidor local sin compresión HTTP y aviso de prueba; no datos de visitantes ni garantía de producción. Esta medición corresponde a la serie visual anterior. La serie v2 utiliza AVIF con alternativa WebP y maestros nuevos; su verificación específica se registra en assets-source/SERIE_EDITORIAL_V2.md.

Se añadió una comprobación automática en GitHub para reconstruir, validar y ejecutar el navegador en solicitudes de cambio y en `main`. No modifica la fuente de publicación de Pages ni despliega el receptor.

Quedan por realizar con personas reales: las seis conversaciones de comprensión de OE2, uso autónomo de Mabel y Ana, selección comercial final, prueba de producción con credenciales reales y métricas de experiencia de visitantes. Son tareas del piloto, no resultados que el código pueda acreditar.

### Conservación comprobada

- PDF original: **339.628.407 bytes**, SHA-256 `e732ab433808cf0baaccd79c6deda0513269b657288b73f91f4a43e889d94b51`.
- Catorce imágenes originales: huellas iguales al manifiesto anterior. Los derivados para lectura web no sustituyen esos originales.
- La carga inicial no incorpora el PDF ni los catorce originales. Ampliar o descargar es una decisión explícita del visitante.
- GitHub conserva historia. La eliminación de contactos requiere revisar también historia y copias privadas, siguiendo el procedimiento del receptor; borrar un JSON actual no basta.

## Cierre del piloto antes de ampliar difusión

Mostrar a dos personas por necesidad de compra las opciones correspondientes y preguntar qué recibirían, qué precio/unidad entienden y cómo consultarían. Anotar dudas concretas, sin presentar seis entrevistas como estimación del mercado. Con cada emprendedora, practicar recepción, lectura, respuesta y borrador tanto para sólo alimentos como para servicio. Ajustar palabras y fichas según las dudas. Mantener la secuencia del Draft: definir oferta y atención antes de ampliar campañas.
