# Plantilla de análisis · ronda final E0–E9

**Versión del prototipo:** ________ · **Fecha de ronda:** ________ · **Analista:** ________  
**Participantes:** 0–5 · **Perfiles realmente representados:** ______________________________

## Umbrales fijados antes de observar

| Indicador | Cálculo | Umbral |
|---|---|---:|
| Tareas sin ayuda | tareas E0–E9 completadas sin ayuda / tareas iniciadas | ≥ 80 % |
| Facilidad (SEQ) | promedio de SEQ 1–7; informar global y por etapa | ≥ 5,5 |
| SUS | promedio del puntaje total 0–100 de cada participante | ≥ 68 |
| Datos iniciales | segundos desde primer foco en formulario hasta confirmación válida | < 30 s |
| Toques sin respuesta | toques en controles sin respuesta / toques totales en controles × 100 | < 10 % |

Un toque sin respuesta es una activación de un control que no produce cambio perceptible, navegación ni estado de carga/error durante la interacción. No contar scroll, toques en texto plano ni gestos fuera de controles. Registrar el numerador y denominador.

## Resumen

- **Tareas autónomas:** ____ / ____ = ____ %
- **SEQ promedio:** ____ / 7
- **SUS promedio:** ____ / 100
- **Tiempo de datos iniciales en E3:** mediana ____ s; rango ____–____ s
- **Toques sin respuesta:** ____ / ____ = ____ %
- **Tareas bloqueadas o con ayuda:** ______________________________
- **Perfiles y dispositivos probados realmente:** ______________________________

## Lectura por etapa

Completar a partir de `Planilla_registro.csv`; no rellenar celdas vacías por inferencia.

| Etapa | Autónomas / iniciadas | SEQ promedio | Tiempo mediano (s) | Errores observados | Primer clic recurrente | Toques sin respuesta / total | Cita o evidencia |
|---|---:|---:|---:|---|---|---|---|
| E0 | | | | | | | |
| E1 | | | | | | | |
| E2 | | | | | | | |
| E3 | | | | | | | |
| E4 | | | | | | | |
| E5 | | | | | | | |
| E6 | | | | | | | |
| E7 | | | | | | | |
| E8 | | | | | | | |
| E9 | | | | | | | |

## Hallazgos

| ID | Etapa | Evidencia observable/cita anonimizada | Frecuencia (n/N) | Severidad (1–4) | Hipótesis, no conclusión | Cambio sugerido | Dueño | Estado |
|---|---|---|---:|---:|---|---|---|---|
| H-01 | | | | | | | | |
| H-02 | | | | | | | | |
| H-03 | | | | | | | | |

## Decisión

- [ ] Umbrales alcanzados en esta muestra exploratoria.
- [ ] Umbrales no alcanzados; priorizar cambios según severidad y frecuencia.
- [ ] Resultado inconcluso por muestra, tareas sin completar, dispositivo o medición.

**Qué se observó:**  
______________________________________________________________________________

**Qué no se puede concluir con cinco personas:** generalización a todos los compradores, efecto causal, significancia estadística, lift, demanda de mercado o rendimiento comercial.

**Próximo paso y responsable:**  
______________________________________________________________________________

## Cálculos

- SEQ global = suma de respuestas SEQ válidas / cantidad de respuestas válidas.
- SUS = promedio de puntajes SUS individuales válidos; cada persona responde el cuestionario una vez.
- Datos iniciales = tiempo E3 entre primer foco de campo y confirmación válida. Si el formulario o sus condiciones cambian frente a otra ronda, no presentar comparación directa.
- Tasa de toques sin respuesta = suma de `toques_sin_respuesta` / suma de `toques_totales` × 100.
- Reportar numeradores, denominadores y valores faltantes. No convertir cinco sesiones en porcentajes de población.

## Lectura de los archivos digitales

- `respuestas_largo.csv` tiene una fila por respuesta. Identifica a la persona con `sesion_id` y `participante`; `sesion_origen` vincula `C-encadenada` con la sesión externa anterior. `camino`, `rol`, `perfil`, `momento` y `etapa` permiten segmentar la vista.
- Para alternativas y escalas, cuenta filas con `omitida=false`. En selección múltiple, `respuesta` contiene una lista JSON; el porcentaje por alternativa puede sumar más de 100 %. Para abiertas, lee `respuesta_texto` junto al código del participante y no publiques citas que incluyan datos personales.
- `otra_texto` conserva el texto añadido a «Otra, ¿cuál?». `ms_respuesta` mide desde que se muestra la pregunta hasta guardar; en `momento=etapa` representa la duración entre «Empezó» y «Terminó».
- Las filas `momento=etapa` usan `pregunta_id=registro_etapa`; `respuesta` contiene JSON con `empezo_en`, `termino_en`, `resultado`, `seq`, `errores`, `nota` y duración. Calcula % logrado sobre tareas con resultado registrado; calcula tiempo mediano solo con duraciones positivas.
- `resumen_por_persona.csv` contiene una fila por sesión y reutiliza las columnas de la planilla de respaldo, incluida `sesion_id`. Los campos de observación que no recoge la consola (por ejemplo, primer clic o toques sin respuesta) quedan vacíos; no los infieras.
- `respuestas_ronda_final.json` conserva el banco de versión, sesiones y filas de respuesta. Los tres archivos se exportan en UTF-8 con BOM.
- El panel SUS muestra el puntaje individual solo si existen los diez ítems válidos. El promedio se calcula entre puntajes completos, no contando omisiones como cero. Las sesiones externas e internas usan el mismo texto SUS.

Los filtros de `respuestas.html` segmentan por camino, rol, momento y participante. Una diferencia entre rutas es descriptiva; con cinco participantes externos y hasta tres internos no permite generalizar ni atribuir causalidad.


## Cambio del 11-nov (22:00): cuestionario final más corto

Por pedido de Carlitos, el cuestionario final bajó a **9 preguntas para externos** y **7 para internos**. El SUS (10 afirmaciones) se reemplazó por **UMUX-Lite**, su versión validada de 2 afirmaciones («Las funciones de este sistema cubren lo que necesito» y «Este sistema es fácil de usar», escala 1–5). El puntaje va de 0 a 100: ((respuesta 1 − 1) + (respuesta 2 − 1)) / 8 × 100. Como referencia exploratoria, 70 o más se lee como comparable al umbral SUS de 68. En las exportaciones, la columna `sus_score` guarda este puntaje UMUX-Lite para las sesiones nuevas.
