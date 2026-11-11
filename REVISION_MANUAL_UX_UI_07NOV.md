# Manual UX/UI y aplicación al prototipo Marley

**Fuente:** `C:\Users\HP\Downloads\Manual_UX_UI_Diseno_Prompting_2026.pdf`, 122 páginas, edición octubre 2026. Texto extraído en `work/manual_ux_ui_2026_extraido.txt`. Revisión focalizada de la estructura completa, advertencias metodológicas, laboratorios y secciones pertinentes; no se han verificado las 122 páginas ni sus diagramas visualmente.

## Criterio de aplicación

El manual es una guía de trabajo y sus casos son didácticos (p. 2), no evidencia de clientes Marley. Sus 12 reglas son operativas y no sustituyen WCAG ni sus pruebas (pp. 2 y 113). Debe convivir con el plan de Claude (`work/claude_lectura_06nov/plan_claude.txt`), las decisiones posteriores de Carlitos y la ronda de cinco perfiles comparable a EP3. No reemplaza ese plan ni autoriza publicar.

| Aspecto del manual | Aplicación a Marley | Estado y comprobación |
|---|---|---|
| Tarea y jerarquía, pp. 5–10 | Producto, máquinas, datos, diagnóstico y propuesta deben mostrar la siguiente acción y conservar la elección. | La ruta hotel llegó a C06 y al CRM con datos ficticios; falta repetir por perfil y errores. |
| Responsive, pp. 97–98 | Probar anchos reducidos e intermedios, texto largo y foco, sin esconder condiciones. | Pendiente geometría y capturas de la versión actual a 320, 390, 768, 1000 y 1280 px. |
| Formularios y estados, pp. 100–103 | Etiquetas, errores que indiquen solución, conservación de datos y distinguir la demo de un envío real. | El flujo local completó C03; faltan pruebas vacíos, correo inválido, teclado y mensajes; no existe backend que confirme envío real. |
| Recuperación, pp. 104–105 | Volver, retomar y corregir sin perder datos; permitir «No lo sé». | Parcial; pendiente verificar edición y retomar. Al elegir restaurante tras propuesta hotel ya confirmada se vuelve a la propuesta anterior: revisar protección y mensaje. |
| Test moderado y SUS, pp. 106–109 | Usar tareas neutrales y no inventar resultados. Mantener T1 tres compradores, T7 ventas, T9 jefatura para comparar con EP3; SUS no es porcentaje de éxito. | Kit existente por verificar en la copia final; pruebas reales aún no ejecutadas. |
| Accesibilidad y diagnóstico, pp. 113–116 | Registrar evidencia por regla, fallas, riesgos y pruebas. No declarar conformidad WCAG por una checklist. | Pendiente auditoría de teclado, contraste, estados y lector. |
| Contenido real y medios, pp. 93, 95–96 | Imagen debe ayudar a comprender y no fingir prueba de cliente; reservar dimensiones y controlar peso. | Conveniencia y panadería ya tienen escenas conceptuales, peso total aprox. 4,45 MB; su optimización requiere evaluación de calidad y rendimiento antes de integrar. |

## Propuesta visual generada

`outputs/Marley-Coffee/evento-cafe-concepto-07nov.png`: escena conceptual de café para eventos generada con IA, sin representar un cliente, instalación ni producto verificado. **Candidata, todavía no incorporada**: la máquina y las tazas presentan marcas/textos pequeños ininteligibles, por lo que se requiere nueva generación o revisión de detalle antes de usar como recurso final. No sustituye el video ni las escenas aprobadas; el plan conserva solo el video principal en la entrada y sitúa videos por negocio en deleite.

## Pendientes

Mantener separadas las 4 variantes, hacer QA del plan, contrastar manual con capturas reales y obtener evidencia de las pruebas. Los ajustes de la copia de trabajo y pendientes previos se registraron en `00_SISTEMA/BITACORA.md`. No se ha desplegado ni modificado la copia del Escritorio.
