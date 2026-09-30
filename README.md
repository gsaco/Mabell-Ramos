# Mabell-Ramos
## Catálogo web

Visor público: https://gsaco.github.io/Mabell-Ramos/

GitHub Pages publica la carpeta `docs` de la rama `main`. El visor muestra las 14 páginas con navegación, selección de categoría y ampliación. No requiere instalar dependencias.

Las 14 imágenes WebP originales conservan la resolución completa y su codificación sin pérdida. El PDF original en `Entregables/catalogo.pdf` permanece intacto y se ofrece como descarga mediante Git LFS.

### Carga del catálogo

- **Vista de pantalla:** el navegador elige una copia de 640, 960 o 1280 píxeles de ancho según el espacio disponible y la densidad de la pantalla. Estas copias se redimensionan para visualización y se codifican en WebP sin pérdida; no reemplazan los originales.
- **Ampliar:** carga la imagen original completa, conservando visible la vista mientras se descarga. Al ajustar vuelve a la versión para pantalla.
- **Página siguiente:** después de mostrar la actual, anticipa sólo una página en la dirección de navegación, con prioridad baja. Respeta el ahorro de datos y las conexiones 2G que informa el navegador; no descarga los 14 originales por anticipado.
- **Enlaces directos:** `#pagina-3` carga Alfajores directamente. No descarga primero la portada ni el PDF.
- **Caché:** las URL estables de las imágenes permiten reutilizar la caché del navegador. Los archivos de código de esta actualización usan `?v=2` para evitar una copia antigua del visor. No se añade un caché de servicio que pueda dejar páginas obsoletas.

Las imágenes originales pesan entre **15,5 y 18,9 MiB** por página. Las vistas para pantalla pesan **467–650 KiB** (640 px), **1014–1370 KiB** (960 px) o **1762–2296 KiB** (1280 px): entre **87,9 % y 97,1 % menos bytes**, según la página y la resolución elegida. Esta reducción mide el archivo de una página; la anticipación puede añadir la descarga de una vista vecina. El tiempo de carga depende también de la red, el dispositivo y la caché. El original completo sigue teniendo su tamaño original al ampliar.

### Actualizar las vistas para pantalla

Tras regenerar las 14 imágenes originales desde un catálogo nuevo, ejecutar con Python y Pillow disponibles:

```sh
python3 tools/generar_vistas_web.py
```

El generador escribe únicamente en `docs/assets/previews`, comprueba que la codificación mantiene exactamente los píxeles de cada vista redimensionada y verifica que no se modifica ninguna imagen original. El manifiesto registra tamaños, dimensiones y huellas SHA-256 de las fuentes. No lee ni modifica el PDF. Al reemplazar imágenes ya publicadas, actualizar también la versión de sus URL para evitar que un lector reutilice una copia anterior durante la vigencia de la caché.

### Verificación de esta actualización

Se revisaron la apertura directa de Alfajores, navegación siguiente, última página, ampliación original, regreso a la vista de pantalla y cambios rápidos de categoría durante la ampliación. En un tamaño móvil de 390 × 844 se comprobó la presentación y la ausencia de desbordamiento horizontal. La carga directa local pidió la vista de Alfajores y una vista de Bombones como anticipación; no pidió la portada ni imágenes originales hasta ampliar. Se verificaron las 42 vistas generadas y la integridad de los 14 originales y del PDF.

Prueba local: `python3 -m http.server 8765 --directory docs`.
