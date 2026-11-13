# Catering: recepción por correo

La página `/catering/` usa FormSubmit, de manera independiente del receptor opcional de GitHub/CRM. Las solicitudes de catering no se importan automáticamente al CRM.

- Destinatario fijo: `mabellramospe@gmail.com`.
- Activación: confirmada por el propietario el 13 de noviembre de 2026.
- Prueba real: enviada desde la interfaz con nombre `PRUEBA WEB — no es un pedido`; el propietario confirmó la llegada al buzón. Referencia `MR-CAT-0768c0ab-1e77-4292-b2d2-e826d80f307f`.
- Configuración pública: `cateringEmailEnabled` en `site-src/content/site-config.json`. No contiene credenciales. Desactivarla cambia el envío de la interfaz a una consulta preparada por WhatsApp.
- Campos principales: nombre y WhatsApp obligatorios; fecha, personas y distrito opcionales; modalidad con opción por definir. Correo y comentario son opcionales en un desplegable.
- Mensaje: asunto con personas, distrito y fecha; cuerpo con todos los datos y referencia. Si hay correo del cliente, se utiliza como Reply-To.
- El éxito se muestra únicamente tras una respuesta positiva del proveedor. Activaciones pendientes, errores HTTP, errores del proveedor y pérdidas de conexión no muestran recepción confirmada.
- Las referencias son de la solicitud, no de una reserva. El proveedor no documenta idempotencia: un reintento tras una respuesta perdida puede duplicar el correo; la referencia se conserva para reconocerlo. No se promete deduplicación.
- El proveedor documenta respaldo de solicitudes por 30 días: https://formsubmit.co/documentation . El archivo de respaldo se consulta mediante su API: https://formsubmit.co/api-documentation . La clave se obtiene en el correo de la empresa; nunca debe incluirse en la web, capturas, archivos públicos ni repositorio. No existe lector público del archivo en esta implementación.
- No hay envíos automáticos de marketing, copia automática al cliente ni archivos adjuntos.
- El aviso `/privacidad/#catering` describe finalidad, proveedor, respaldo y contacto.
- Las pruebas automatizadas interceptan el proveedor: no envían correos reales. La prueba real citada arriba fue realizada por separado con autorización del usuario.

Los cambios de la web están compilados localmente en `docs/`. La activación del servicio de correo no publica cambios en GitHub Pages.
