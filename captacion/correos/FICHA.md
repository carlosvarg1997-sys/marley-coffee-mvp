# Ficha de correos · Marley Coffee Empresas

Prototipo académico de ciclo de vida. Los mensajes son muestras locales: no se envían ni registran aperturas. No contienen datos reales ni píxeles de seguimiento.

## Reglas comunes

- Cada correo declara los tokens de CRM que usa en su ficha; los campos disponibles se completan desde la solicitud, la propuesta, la cuenta o el caso correspondiente.
- Supresión de captación: los clientes activos salen de la captación general. Los correos contractuales y de servicio se conservan solo para su finalidad; los promocionales requieren permiso de marketing vigente.
- Los correos E04, E05, E09, E11 y E12 incluyen un enlace de baja. En el prototipo, la baja solo muestra una confirmación; no guarda una preferencia real.
- No se fijan precios, plazos, condiciones comerciales ni incentivos. Los criterios de envío E03, E11 y E12 son «propuesta inicial, a validar con Ventas»: reglas internas, no promesas al cliente.
- Antes de cualquier lanzamiento, verificar la fecha de entrada en vigor de la Ley 21.719 y si existe una posible postergación.
- El CTA de cada correo usa `utm_source=email&utm_medium=email&utm_campaign=<ID>&utm_content=<slug_del_CTA>`.

## Mapa de mensajes

### E01 · Recibimos tu solicitud

- **Etapa:** Interacción.
- **Asunto (36 caracteres):** Guardamos tu avance · N.º {{numero}}
- **Texto previo (37 caracteres):** Con tu número retomas donde quedaste.
- **Gancho visual:** Tu solicitud.
- **Titular del héroe:** Guardamos tu avance.
- **Palabra resaltada:** avance.
- **Ficha Cuentas claras:** N.º de seguimiento · {{numero}}; Negocio · {{negocio}}; Siguiente paso · Completar los 3 pasos; Condiciones · Se confirman en tu propuesta.
- **Disparador:** lead_created.
- **Segmento:** Lead nuevo con solicitud confirmada.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{numero}}`.
- **Base de permiso:** Seguimiento de la solicitud. Seguimiento de la solicitud enviada; no habilita marketing.
- **Exclusiones:** Clientes activos fuera de la captación; contactos sin solicitud confirmada y personas con oposición o baja.
- **Indicador principal:** Avance a revisión de la solicitud en el portal; atribución por UTM, sin píxel.
- **CTA:** Seguir con el diagnóstico.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E01&utm_content=seguir_con_el_diagnostico#C04`
- **Por qué lo recibe:** Recibes este correo porque enviaste una solicitud en el portal de Marley Coffee Empresas.

### E02 · Tu propuesta está lista

- **Etapa:** Interacción.
- **Asunto (23 caracteres):** Tu propuesta está lista
- **Texto previo (47 caracteres):** Ya puedes revisar lo preparado para tu negocio.
- **Gancho visual:** Propuesta enviada.
- **Titular del héroe:** Tu propuesta está lista.
- **Palabra resaltada:** propuesta.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Propuesta · {{quote_id}} · v{{quote_version}}; Producto / cantidad · {{producto}} · {{cantidad_sugerida}}; Condiciones · Se confirman en tu propuesta.
- **Disparador:** quote_sent.
- **Segmento:** Contacto con propuesta enviada.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{quote_id}}`, `{{quote_version}}`, `{{producto}}`, `{{cantidad_sugerida}}`.
- **Base de permiso:** Seguimiento de la solicitud. Seguimiento de la propuesta que la persona pidió.
- **Exclusiones:** Clientes activos fuera de la captación; contactos sin propuesta enviada y personas con oposición o baja.
- **Indicador principal:** Revisión de propuesta y avance a contract_signed.
- **CTA:** Revisar propuesta.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E02&utm_content=revisar_propuesta#C05`
- **Por qué lo recibe:** Recibes este correo porque pediste una propuesta y se registró su envío.

### E03 · Recordatorio de tu propuesta

- **Etapa:** Interacción.
- **Asunto (22 caracteres):** Tu propuesta te espera
- **Texto previo (49 caracteres):** Un acceso directo a la propuesta que solicitaste.
- **Gancho visual:** Recordatorio.
- **Titular del héroe:** Tu propuesta te espera.
- **Palabra resaltada:** espera.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Propuesta · {{quote_id}} · v{{quote_version}}; Respuesta registrada · Pendiente; Condiciones · Se confirman en tu propuesta.
- **Disparador:** propuesta inicial, a validar con Ventas: 3 días hábiles sin respuesta a la propuesta; un solo recordatorio.
- **Segmento:** Lead con propuesta enviada y sin respuesta registrada.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{quote_id}}`, `{{quote_version}}`.
- **Base de permiso:** Seguimiento de la solicitud. Seguimiento de la propuesta que la persona pidió.
- **Exclusiones:** Clientes activos fuera de la captación; excluir cuando haya respuesta, oposición o baja.
- **Indicador principal:** Propuesta revisada después del correo; atribución por UTM, sin píxel.
- **CTA:** Volver a la propuesta.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E03&utm_content=volver_propuesta#C05`
- **Por qué lo recibe:** Recibes este recordatorio porque pediste una propuesta y todavía no se registra una respuesta.

### E04 · Retoma tu solicitud

- **Etapa:** Interacción.
- **Asunto (19 caracteres):** Tu avance te espera
- **Texto previo (55 caracteres):** Puedes retomar el formulario que enviaste parcialmente.
- **Gancho visual:** Formulario iniciado.
- **Titular del héroe:** Retoma tu solicitud.
- **Palabra resaltada:** solicitud.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Comprador · {{comprador}}; Paso 1 · Enviado; Siguiente paso · Completar el paso 2.
- **Disparador:** Paso 1 enviado y paso 2 pendiente.
- **Segmento:** Contacto parcial que envió el paso 1 y aceptó recordatorios.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`.
- **Base de permiso:** Permiso de recordatorios (marketing). Permiso de recordatorios de marketing afirmativo y vigente; el envío del paso 1 no basta por sí solo.
- **Exclusiones:** Sin permiso vigente: excluir. Clientes activos fuera de la captación. Excluir tras baja u oposición.
- **Indicador principal:** Continuación a lead_created después del recordatorio.
- **CTA:** Continuar solicitud.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E04&utm_content=continuar_solicitud#C03`
- **Por qué lo recibe:** Recibes este correo porque enviaste el primer paso y aceptaste recibir recordatorios para continuar la solicitud.

### E05 · Guía «Cuentas claras»

- **Etapa:** Interacción.
- **Asunto (27 caracteres):** Cuentas claras para decidir
- **Texto previo (58 caracteres):** Una guía breve para ordenar las preguntas antes de elegir.
- **Gancho visual:** Guía para decidir.
- **Titular del héroe:** Cuentas claras.
- **Palabra resaltada:** claras.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Producto · {{producto}}; Cantidad sugerida · {{cantidad_sugerida}}; Condiciones · Se confirman en tu propuesta.
- **Disparador:** Lead sin avance.
- **Segmento:** Lead sin avance, sin contrato activo y con permiso de marketing vigente.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{producto}}`, `{{cantidad_sugerida}}`.
- **Base de permiso:** Permiso de marketing. Permiso de marketing afirmativo y vigente.
- **Exclusiones:** Clientes activos fuera de la captación; excluir sin permiso, tras baja u oposición.
- **Indicador principal:** Visitas a la guía atribuibles a E05 mediante UTM; sin píxel.
- **CTA:** Leer guía Cuentas claras.
- **UTM del CTA:** `../contenidos/index.html?utm_source=email&utm_medium=email&utm_campaign=E05&utm_content=leer_guia_cuentas_claras`
- **Por qué lo recibe:** Recibes esta guía porque aceptaste comunicaciones de marketing de Marley Coffee Empresas.

### E06 · Bienvenida y próximos pasos

- **Etapa:** Alta.
- **Asunto (27 caracteres):** Bienvenida y próximos pasos
- **Texto previo (50 caracteres):** Lo esencial para comenzar la relación de servicio.
- **Gancho visual:** Relación contractual.
- **Titular del héroe:** Bienvenida.
- **Palabra resaltada:** Bienvenida.
- **Ficha Cuentas claras:** Contrato · {{contract_id}}; Cuenta · {{account_id}}; Negocio · {{negocio}}; Estado · Contrato firmado.
- **Disparador:** contract_signed.
- **Segmento:** Cuenta con contrato registrado.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{contract_id}}`, `{{account_id}}`.
- **Base de permiso:** Relación contractual. Relación contractual; comunicación necesaria para orientar los próximos pasos.
- **Exclusiones:** Excluir de captación general. Mantener solo comunicaciones contractuales/de servicio; nada promocional sin permiso de marketing.
- **Indicador principal:** Primer pedido confirmado (order_confirmed).
- **CTA:** Revisar mi cuenta.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E06&utm_content=revisar_cuenta#C09`
- **Por qué lo recibe:** Recibes este correo como parte de la relación contractual de Marley Coffee Empresas con {{negocio}}.

### E07 · Tu primera semana (por rol)

- **Etapa:** Alta.
- **Asunto (30 caracteres):** Tu primera semana, paso a paso
- **Texto previo (50 caracteres):** Una guía para revisar lo que corresponde a tu rol.
- **Gancho visual:** Una guía para tu rol.
- **Titular del héroe:** Tu primera semana.
- **Palabra resaltada:** semana.
- **Ficha Cuentas claras:** Contrato · {{contract_id}}; Cuenta · {{account_id}}; Negocio · {{negocio}}; Rol · {{comprador}}.
- **Disparador:** Días después del alta.
- **Segmento:** Cuenta recién dada de alta; contenido ajustado al rol comprador.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{contract_id}}`, `{{account_id}}`.
- **Base de permiso:** Relación contractual. Relación contractual; guía de incorporación del servicio.
- **Exclusiones:** Excluir de captación general. Mantener solo comunicaciones contractuales/de servicio; nada promocional sin permiso de marketing.
- **Indicador principal:** Visita a los próximos pasos desde E07, atribuida por UTM; sin píxel.
- **CTA:** Ver próximos pasos.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E07&utm_content=ver_proximos_pasos#C09`
- **Por qué lo recibe:** Recibes este correo porque {{negocio}} está en la etapa inicial de su relación contractual con Marley Coffee Empresas.

### E08 · Aviso de reposición

- **Etapa:** Deleite.
- **Asunto (35 caracteres):** Aviso de reposición para tu negocio
- **Texto previo (54 caracteres):** Revisa la cadencia o el consumo estimado de tu cuenta.
- **Gancho visual:** Aviso de servicio.
- **Titular del héroe:** Aviso de reposición.
- **Palabra resaltada:** reposición.
- **Ficha Cuentas claras:** Producto · {{producto}}; Cantidad sugerida · {{cantidad_sugerida}}; Cadencia · {{cadencia}}; Cómo pedir · Desde tu cuenta, en 2 toques.
- **Disparador:** Cadencia o consumo estimado.
- **Segmento:** Cuenta activa con cadencia o consumo estimado para revisar.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{producto}}`, `{{cantidad_sugerida}}`, `{{cadencia}}`.
- **Base de permiso:** Servicio. Servicio asociado a la cuenta; no es una campaña promocional.
- **Exclusiones:** Excluir de captación general. Mantener solo avisos de servicio; pausar si existe una incidencia abierta.
- **Indicador principal:** Pedido repetido confirmado (repeat_order_confirmed).
- **CTA:** Revisar reposición.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E08&utm_content=revisar_reposicion#C09`
- **Por qué lo recibe:** Recibes este aviso de servicio según la cadencia o el consumo estimado asociado a tu cuenta.

### E09 · Novedades para tu negocio

- **Etapa:** Deleite.
- **Asunto (25 caracteres):** Novedades para tu negocio
- **Texto previo (67 caracteres):** Información de Marley Coffee Empresas para revisar cuando te sirva.
- **Gancho visual:** Contenido para empresas.
- **Titular del héroe:** Novedades.
- **Palabra resaltada:** Novedades.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Comprador · {{comprador}}; Producto · {{producto}}; Tema · Café para empresas.
- **Disparador:** Calendario editorial.
- **Segmento:** Comprador con permiso de marketing vigente; contenido por tipo de negocio.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{producto}}`.
- **Base de permiso:** Permiso de marketing. Permiso de marketing afirmativo y vigente.
- **Exclusiones:** Clientes activos excluidos de captación general; excluir sin permiso, tras baja u oposición. La comunicación sigue siendo promocional.
- **Indicador principal:** Visitas al contenido atribuibles a E09 mediante UTM; sin píxel.
- **CTA:** Ver novedades.
- **UTM del CTA:** `../contenidos/index.html?utm_source=email&utm_medium=email&utm_campaign=E09&utm_content=ver_novedades`
- **Por qué lo recibe:** Recibes estas novedades porque aceptaste comunicaciones de marketing de Marley Coffee Empresas.

### E10 · ¿Cómo lo estamos haciendo?

- **Etapa:** Deleite.
- **Asunto (26 caracteres):** ¿Cómo lo estamos haciendo?
- **Texto previo (58 caracteres):** Queremos conocer tu experiencia tras la entrega o el caso.
- **Gancho visual:** Después de una entrega o caso.
- **Titular del héroe:** Tu experiencia.
- **Palabra resaltada:** experiencia.
- **Ficha Cuentas claras:** Caso · {{case_id}}; Tipo · {{tipo}}; Qué evaluamos · Atención · escala de 1 a 5; Cuánto toma · No hay tiempo estimado.
- **Disparador:** Después de una entrega o de un caso.
- **Segmento:** Cuenta que registró una entrega o un caso de servicio.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{case_id}}`, `{{tipo}}`.
- **Base de permiso:** Servicio. Servicio y evaluación de la experiencia asociada a una entrega o caso.
- **Exclusiones:** Excluir de captación general. Mantener la solicitud de opinión como servicio; no usar la respuesta para promocionar sin permiso.
- **Indicador principal:** Encuestas respondidas (csat_submitted).
- **CTA:** Contar mi experiencia.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E10&utm_content=contar_experiencia#C09`
- **Por qué lo recibe:** Recibes este correo después de una entrega o de un caso de servicio asociado a {{negocio}}.

### E11 · Recomienda a otro negocio

- **Etapa:** Deleite.
- **Asunto (25 caracteres):** Recomienda a otro negocio
- **Texto previo (52 caracteres):** Comparte esta información si crees que puede servir.
- **Gancho visual:** Invitación a compartir.
- **Titular del héroe:** Recomienda.
- **Palabra resaltada:** Recomienda.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Comprador · {{comprador}}; Para compartir · Información de Marley Coffee Empresas; Recompensa · No hay recompensa definida.
- **Disparador:** propuesta inicial, a validar con Ventas: ofrecer recomendación solo con 9 o 10 en la pregunta de 0 a 10 (definición estándar de promotor).
- **Segmento:** Cliente con respuesta 9 o 10 en la pregunta de 0 a 10 y permiso de marketing vigente.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`.
- **Base de permiso:** Permiso de marketing. Permiso de marketing afirmativo y vigente, además de una respuesta 9 o 10 en la pregunta de 0 a 10.
- **Exclusiones:** Excluir clientes activos de campañas de captación general, sin perjuicio de esta invitación. Excluir sin permiso, tras baja u oposición.
- **Indicador principal:** Referidos enviados (referral_sent), solo si la acción se instrumenta y confirma.
- **CTA:** Abrir página para compartir.
- **UTM del CTA:** `../soluciones/index.html?utm_source=email&utm_medium=email&utm_campaign=E11&utm_content=abrir_pagina_para_compartir`
- **Por qué lo recibe:** Recibes esta invitación porque compartiste una experiencia favorable y aceptaste comunicaciones de marketing.

### E12 · Te echamos de menos

- **Etapa:** Reactivación.
- **Asunto (31 caracteres):** Si quieres, revisamos tu cuenta
- **Texto previo (49 caracteres):** Puedes volver a conversar cuando te haga sentido.
- **Gancho visual:** Volver a conversar.
- **Titular del héroe:** Revisar tu cuenta.
- **Palabra resaltada:** cuenta.
- **Ficha Cuentas claras:** Negocio · {{negocio}}; Producto · {{producto}}; Cadencia habitual · {{cadencia}}; Siguiente paso · Pedir una conversación.
- **Disparador:** propuesta inicial, a validar con Ventas: sin pedidos durante el doble de la cadencia habitual de reposición de la cuenta.
- **Segmento:** Cuenta sin pedidos durante el doble de su cadencia habitual de reposición.
- **Campos personalizables:** `{{nombre}}`, `{{negocio}}`, `{{comprador}}`, `{{producto}}`, `{{cadencia}}`.
- **Base de permiso:** Permiso de marketing. Permiso de marketing afirmativo y vigente.
- **Exclusiones:** Excluir cuentas activas y clientes que ya retomaron pedidos; excluir sin permiso, tras baja u oposición.
- **Indicador principal:** Pedidos repetidos confirmados después de E12 (repeat_order_confirmed).
- **CTA:** Revisar mi cuenta.
- **UTM del CTA:** `../../index.html?utm_source=email&utm_medium=email&utm_campaign=E12&utm_content=revisar_cuenta#C09`
- **Por qué lo recibe:** Recibes este correo porque el período configurado para reactivación no registra pedidos de {{negocio}}.

## Plantilla y revisión

`PLANTILLA.html` es la base de tablas para correo, con estilos inline, media query embebida y sin hojas de estilo externas. El héroe usa Festivo a 48 px en escritorio y 36 px en móvil; Pressura y Festivo declaran familias de respaldo para correo.

`recursos/marley-email-blanco.png` se genera desde `recursos/marca/logo.webp` con Python/Pillow, preservando transparencia y recoloreando la marca para el encabezado negro.

E10 no publica un tiempo estimado: el CRM y el formulario del portal no definen cuánto toma la evaluación.

El enlace de baja dirige a `bandeja.html?baja=<ID>`. La pantalla confirma que es una simulación y no cambia una lista de contactos.

Antes de activar E03, E11 o E12, Ventas debe validar los parámetros iniciales de envío indicados en sus fichas y deben revisarse las bases legales vigentes.
