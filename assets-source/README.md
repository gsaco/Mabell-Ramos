# Recursos visuales del sitio de consumidores

Los maestros originales están en `originals/`. Se copiaron sin modificar desde los recursos ya preparados para el proyecto de Mabell Ramos. El sitio sirve exclusivamente los derivados de `docs/assets/web/`. El catálogo y sus documentos originales no se comprimen ni se sustituyen.

`manifest.json` registra procedencia, tipo, dimensiones, peso, descripción accesible y huella SHA-256 de cada archivo. Las imágenes de alimentos existentes son **ilustraciones editoriales generadas/recompuestas de referencia**; no documentan productos entregados, ingredientes verificados, número de piezas ni montajes reales. Deben identificarse como referencia en el sitio y reemplazarse en las fichas comerciales cuando se fotografíe la opción aprobada.

El logo se recortó de `fuente-logo-mabell.png` con coordenadas fijas, preservando sus letras y color. El sello generado de mayor tamaño se descartó como logo porque cambia detalles de la marca. El recorte original tiene 298×295 píxeles, suficiente para el tamaño de cabecera; los derivados no se amplían artificialmente.

La rama, el patrón, el arco y los iconos son SVG nativos editables. No se les atribuye significado cultural histórico. Inter y Bodoni Moda se alojan localmente y conservan sus licencias SIL Open Font License.

Para regenerar los derivados:

```sh
python3 -m pip install 'fonttools[woff]' Pillow Brotli
python3 tools/prepare-assets.py
```

El proceso conserva los maestros, impide el aumento artificial de resolución y produce WebP de calidad 96, logo WebP sin pérdidas, WOFF2 y una imagen editorial para enlaces compartidos. Las fotografías reales de productos, retratos, catering y videos siguen pendientes: no se fabricaron sustitutos documentales.
