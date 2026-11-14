# Video completo de Mabell Ramos

Fuente: `EMPRENDEDORAS 3.01.mp4`, proporcionado por el usuario. El original permanece intacto en su ubicación local.

- `mabell-ramos-historia.mp4`: película completa, aproximadamente 1:40, 1920 × 1080, H.264 y audio AAC. Conserva todos los segmentos y los subtítulos integrados en el original. Optimizada para reproducción progresiva; no se descarga al abrir la página.
- `mabell-ramos-poster.jpg`: fotograma real del segundo 50. No es una recreación generada.

La página muestra la película después del encabezado y antes de los sabores. El reproductor nativo conserva sus controles sin JavaScript; con JavaScript se añade la portada con botón de reproducción. No hay reproducción automática ni servicios de video externos.

Preparación con FFmpeg:

```sh
ffmpeg -i "EMPRENDEDORAS 3.01.mp4" -map 0:v:0 -map 0:a:0 \
  -vf 'fps=30000/1001' -c:v libx264 -preset slow -crf 25 \
  -maxrate 1800k -bufsize 3600k -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart -map_metadata -1 \
  mabell-ramos-historia.mp4
ffmpeg -ss 50 -i "EMPRENDEDORAS 3.01.mp4" -frames:v 1 -q:v 3 mabell-ramos-poster.jpg
```

El build copia ambos archivos a `docs/assets/web/historia/`. Las vistas previas portátiles incluyen el video en su subcarpeta `media/`.

Referencias técnicas: [carga de video bajo demanda](https://web.dev/articles/lazy-loading-video) y [MP4 con faststart](https://ffmpeg.org/ffmpeg-formats.html).
