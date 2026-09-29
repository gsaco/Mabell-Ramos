# Mabell-Ramos
## Catálogo web

Visor público: https://gsaco.github.io/Mabell-Ramos/

GitHub Pages publica la carpeta `docs` de la rama `main`. El visor muestra las 14 páginas con navegación, selección de categoría y ampliación. No requiere instalar dependencias.

Las imágenes WebP se extraen del PDF original a resolución completa y se codifican sin pérdida. El PDF original en `Entregables/catalogo.pdf` permanece intacto y se ofrece como descarga mediante Git LFS. Para actualizar el catálogo hay que sustituir el PDF y regenerar las imágenes del visor.

Prueba local: `python3 -m http.server 8765 --directory docs`.
