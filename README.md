# Mabell Ramos · Web para clientes

Sitio de **Inicio, Productos, Catering y Catálogo**, preparado para el repositorio `gsaco/Mabell-Ramos` y su GitHub Pages en `/Mabell-Ramos/`. Implementación del [plan maestro](planificacion/Plan_maestro_web_consumidores_Mabell_Ramos.md).

La interfaz se publica en [GitHub Pages](https://gsaco.github.io/Mabell-Ramos/) desde `main /docs`. La recepción de consultas permanece desactivada hasta configurar su servidor y bandeja privada; publicar el sitio no conecta por sí solo ese receptor. No se añade un número de WhatsApp. Instagram es el contacto comercial disponible.

## Qué incluye

- Identidad editorial con los morados del Draft, Bodoni Moda e Inter locales, logo auténtico, SVG y recursos responsivos.
- Preparaciones del catálogo, orientación para disfrutar/regalar/descubrir y soporte completo para productos y opciones comerciales aprobados.
- Opciones con contenido, cantidad, presentación, precio por unidad de venta, entrega, cambios, enlace estable y formulario desplegable. Los grupos vacíos se omiten.
- Catering que diferencia sólo alimentos de alimentos y servicio, sin convertir asistentes en una tarifa ni reservar automáticamente una fecha.
- Formularios accesibles, fecha por definir, contacto por correo, validación, constancia comprobada, referencia copiable, reintentos sin duplicación y revisión de condiciones actualizadas sin perder lo escrito.
- El visor original con selector, flechas, teclado, ampliación, las catorce páginas y el PDF intacto. Añade consulta contextual y lectura HTML revisada.
- Receptor de consultas en servidor con almacenamiento en GitHub **privado** e importador en el repositorio `Mabell-Ramos-CRM`.

Los seis productos y seis paquetes del Draft todavía requieren selección comercial. La web no publica ejemplos de prueba ni inventa aprobación: hoy muestra preparaciones documentadas y el catálogo de referencia. Al publicar la exportación aprobada de Gestión, las tarjetas y grupos se generan automáticamente. El catálogo PDF no cambia cuando cambia un precio estructurado.

## Ejecutar y comprobar

Requiere Node 22 o posterior:

```sh
npm ci
npm run build
npm run dev
```

Abrir la dirección que indique el servidor. Conserva la base `/Mabell-Ramos/`, igual que GitHub Pages. Otro alojamiento/base puede construirse con `SITE_BASE=/ npm run build`.

```sh
npm test
npm run test:e2e
```

Las pruebas del navegador usan Chrome instalado en macOS, o Chromium de Playwright en CI. No incluyen tokens reales, datos comerciales ni consultas de personas. Las opciones ficticias se generan **fuera de `docs`**, en `.local-data/fixture-site`, para comprobar seis tarjetas, grupos, revisión de precios y retirada. No se publican.

## Probar envíos locales

En una terminal:

```sh
node services/inquiry-receiver/local-server.mjs --enable-local \
  --catalog site-src/content/catalog-public.json \
  --origins http://127.0.0.1:4173 --privacy-version local-preview-v1
```

En otra:

```sh
npm run dev -- --local-receiver
```

Esta vista lleva un aviso. Guarda archivos reales **sólo en este equipo**, en una carpeta privada ignorada por Git. La configuración local se sirve en memoria; no se escribe en el sitio público. No representa recepción en el CRM de producción.

## Publicar oferta desde Gestión

1. Conectar el CRM al repositorio privado de trabajo. Los datos de demostración no son exportables a la web.
2. Revisar las fichas de producto y los paquetes con Mabel y Ana. Aprobar por separado su uso comercial y su visibilidad pública.
3. En Biblioteca → Preparar oferta para la web, revisar el contenido y descargar la exportación pública. Los precios se expresan en céntimos enteros, con unidad y revisión.
4. Importar **esa exportación**, nunca una copia de `AppState`:

```sh
npm run offer:import -- /ruta/oferta-publica-revisada.json
npm run build
npm test
npm run test:e2e
```

5. Revisar visualmente y publicar los archivos generados en `docs`. El importador impide reutilizar una versión con contenido diferente y exige revisión nueva si cambian condiciones de una opción.

Cambiar precio o contenido en Gestión pausa la autorización pública hasta otra revisión. Un costo interno no se publica y editar el precio no reemplaza silenciosamente el PDF. La primera versión usa una exportación controlada por el mantenedor, conforme al plan; no un publicador automático con credenciales en la web.

## GitHub Pages y recepción privada

Conservar la fuente actual **main /docs**, sin cambiar el repositorio ni los enlaces antiguos. `npm run build` genera páginas reales; `docs/.nojekyll` ya existe. La publicación desde esa carpeta se produce al enviar los cambios a la rama configurada. [Documentación de GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

GitHub Pages sirve la interfaz estática. El guardado privado necesita el receptor de servidor de [services/inquiry-receiver](services/inquiry-receiver/README.md). El código del receptor está completo, pero permanece desactivado hasta configurar un repositorio privado, credenciales de servidor, protección antispam y aviso de privacidad. No es necesario Supabase. La web y los datos quedan en GitHub; el Worker es únicamente el puente de escritura protegida, no otro alojamiento para la web.

En `site-src/content/site-config.json` se configuran sólo valores públicos: endpoint HTTPS, clave pública de protección, aviso aprobado y contacto de privacidad. Las credenciales jamás van en ese archivo, `docs`, JavaScript o Git. Antes de activarlo, comprobar una consulta real en una bandeja privada de prueba y su importación al CRM. Mientras está pendiente, se ofrece Instagram y el formulario no puede afirmar una recepción.

La configuración del CRM, permisos y sincronización se documentan en `Mabell-Ramos-CRM/docs/CONEXION_WEB_CONSUMIDORES.md`.

## Catálogo original y recursos

Los enlaces `/Mabell-Ramos/#pagina-N` siguen funcionando: redirigen al visor `/Mabell-Ramos/catalogo/#pagina-N`. No se duplica el catálogo para moverlo.

- **Pantalla:** derivados separados de 640/960/1280 px; precarga de una sola página vecina después de la actual, respetando ahorro de datos.
- **Ampliar:** carga el original completo. Las flechas del teclado se manejan sólo dentro del visor, sin interferir con formularios.
- **PDF:** descarga voluntaria del original de 339.628.407 bytes. SHA-256 `e732ab433808cf0baaccd79c6deda0513269b657288b73f91f4a43e889d94b51`. No se comprime ni se descarga al entrar.
- **Transcripción:** las catorce páginas se revisaron visualmente, conservando precios, unidades y notas. Es información del catálogo referencial, no aprobación automática de tarifas.
- **Assets:** maestros intactos en `assets-source`, inventario de procedencia/huellas y 29 recursos públicos en `docs/assets/web`. Las ilustraciones llevan una leyenda visible. La fotografía de mesa corresponde a presentación en feria; no prueba un servicio de catering.
- **Videos:** componente preparado para clips reales autorizados, sin reproducción automática ni carga previa. No se inventa un video ni un retrato.

Regenerar vistas del catálogo: `python3 tools/generar_vistas_web.py`. Regenerar recursos nuevos: `python3 tools/prepare-assets.py`. Ambos preservan maestros; requieren las dependencias indicadas en sus instrucciones.

## Mantener y recuperar

Guía de tareas y cobertura: [IMPLEMENTACION_WEB.md](planificacion/IMPLEMENTACION_WEB.md). Volver a una versión pública anterior sólo cambia el sitio; no borra la recepción privada ni los pedidos del CRM. Probar cualquier restauración con la misma edición y contratos antes de reenviar consultas.
