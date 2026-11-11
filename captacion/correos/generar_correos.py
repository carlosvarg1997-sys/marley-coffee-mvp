from __future__ import annotations

from html import escape
from pathlib import Path
import re
from urllib.parse import urlencode, urlsplit, urlunsplit

from PIL import Image


ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
LOGO_SOURCE = PROJECT / "recursos" / "marca" / "logo.webp"
LOGO_OUTPUT = ROOT / "recursos" / "marley-email-blanco.png"
TEMPLATE_PATH = ROOT / "PLANTILLA.html"


EMAILS = [
    {
        "id": "E01",
        "name": "Recibimos tu solicitud",
        "stage": "Interacción",
        "stage_key": "interaccion",
        "base": "Seguimiento de la solicitud",
        "base_key": "solicitud",
        "trigger": "lead_created",
        "segment": "Lead nuevo con solicitud confirmada.",
        "permission": "Seguimiento de la solicitud enviada; no habilita marketing.",
        "exclusions": "Clientes activos fuera de la captación; contactos sin solicitud confirmada y personas con oposición o baja.",
        "kpi": "Avance a revisión de la solicitud en el portal; atribución por UTM, sin píxel.",
        "fields": "nombre, negocio, comprador y número de seguimiento",
        "subject": "Guardamos tu avance · N.º {{numero}}",
        "preheader": "Con tu número retomas donde quedaste.",
        "body": [
            "Recibes este correo porque enviaste una solicitud en el portal de Marley Coffee Empresas.",
            "Hola {{nombre}}. Guardamos tu avance para {{negocio}}. Tu número de seguimiento es {{numero}}; con él retomas donde quedaste.",
            "Como {{comprador}}, puedes seguir con el diagnóstico. Al terminar los 3 pasos te enviamos tu propuesta.",
        ],
        "cta": "Seguir con el diagnóstico",
        "cta_slug": "seguir_con_el_diagnostico",
        "destination": "../../index.html#C04",
        "unsubscribe": False,
    },
    {
        "id": "E02",
        "name": "Tu propuesta está lista",
        "stage": "Interacción",
        "stage_key": "interaccion",
        "base": "Seguimiento de la solicitud",
        "base_key": "solicitud",
        "trigger": "quote_sent",
        "segment": "Contacto con propuesta enviada.",
        "permission": "Seguimiento de la propuesta que la persona pidió.",
        "exclusions": "Clientes activos fuera de la captación; contactos sin propuesta enviada y personas con oposición o baja.",
        "kpi": "Revisión de propuesta y avance a contract_signed.",
        "subject": "Tu propuesta está lista",
        "preheader": "Ya puedes revisar lo preparado para tu negocio.",
        "body": [
            "Recibes este correo porque pediste una propuesta y se registró su envío.",
            "Hola {{nombre}}. Ya puedes revisar la propuesta de {{negocio}}. Como {{comprador}}, encontrarás la información preparada para tu solicitud.",
            "Los precios, la disponibilidad, los servicios y las condiciones se confirman en tu propuesta.",
        ],
        "cta": "Revisar propuesta",
        "cta_slug": "revisar_propuesta",
        "destination": "../../index.html#C05",
        "unsubscribe": False,
    },
    {
        "id": "E03",
        "name": "Recordatorio de tu propuesta",
        "stage": "Interacción",
        "stage_key": "interaccion",
        "base": "Seguimiento de la solicitud",
        "base_key": "solicitud",
        "trigger": "propuesta inicial, a validar con Ventas: 3 días hábiles sin respuesta a la propuesta; un solo recordatorio.",
        "segment": "Lead con propuesta enviada y sin respuesta registrada.",
        "permission": "Seguimiento de la propuesta que la persona pidió.",
        "exclusions": "Clientes activos fuera de la captación; excluir cuando haya respuesta, oposición o baja.",
        "kpi": "Propuesta revisada después del correo; atribución por UTM, sin píxel.",
        "subject": "Tu propuesta te espera",
        "preheader": "Un acceso directo a la propuesta que solicitaste.",
        "body": [
            "Recibes este recordatorio porque pediste una propuesta y todavía no se registra una respuesta.",
            "Hola {{nombre}}. Puedes revisar de nuevo la propuesta para {{negocio}} cuando te acomode. Como {{comprador}}, si algo no está claro, los precios y las condiciones se confirman en tu propuesta.",
        ],
        "cta": "Volver a la propuesta",
        "cta_slug": "volver_propuesta",
        "destination": "../../index.html#C05",
        "unsubscribe": False,
    },
    {
        "id": "E04",
        "name": "Retoma tu solicitud",
        "stage": "Interacción",
        "stage_key": "interaccion",
        "base": "Permiso de recordatorios (marketing)",
        "base_key": "recordatorios",
        "trigger": "Paso 1 enviado y paso 2 pendiente",
        "segment": "Contacto parcial que envió el paso 1 y aceptó recordatorios.",
        "permission": "Permiso de recordatorios de marketing afirmativo y vigente; el envío del paso 1 no basta por sí solo.",
        "exclusions": "Sin permiso vigente: excluir. Clientes activos fuera de la captación. Excluir tras baja u oposición.",
        "kpi": "Continuación a lead_created después del recordatorio.",
        "subject": "Tu avance te espera",
        "preheader": "Puedes retomar el formulario que enviaste parcialmente.",
        "body": [
            "Recibes este correo porque enviaste el primer paso y aceptaste recibir recordatorios para continuar la solicitud.",
            "Hola {{nombre}}. El avance de {{negocio}} sigue disponible para que lo revises. Como {{comprador}}, puedes completar los datos cuando te acomode.",
        ],
        "cta": "Continuar solicitud",
        "cta_slug": "continuar_solicitud",
        "destination": "../../index.html#C03",
        "unsubscribe": True,
    },
    {
        "id": "E05",
        "name": "Guía «Cuentas claras»",
        "stage": "Interacción",
        "stage_key": "interaccion",
        "base": "Permiso de marketing",
        "base_key": "marketing",
        "trigger": "Lead sin avance",
        "segment": "Lead sin avance, sin contrato activo y con permiso de marketing vigente.",
        "permission": "Permiso de marketing afirmativo y vigente.",
        "exclusions": "Clientes activos fuera de la captación; excluir sin permiso, tras baja u oposición.",
        "kpi": "Visitas a la guía atribuibles a E05 mediante UTM; sin píxel.",
        "subject": "Cuentas claras para decidir",
        "preheader": "Una guía breve para ordenar las preguntas antes de elegir.",
        "body": [
            "Recibes esta guía porque aceptaste comunicaciones de marketing de Marley Coffee Empresas.",
            "Hola {{nombre}}. La guía «Cuentas claras» reúne preguntas para revisar una propuesta de café para {{negocio}}. Como {{comprador}}, puedes usarla para ordenar lo que quieres confirmar con el equipo.",
            "Los precios y las condiciones comerciales se confirman en tu propuesta.",
        ],
        "cta": "Leer guía Cuentas claras",
        "cta_slug": "leer_guia_cuentas_claras",
        "destination": "../contenidos/index.html",
        "unsubscribe": True,
    },
    {
        "id": "E06",
        "name": "Bienvenida y próximos pasos",
        "stage": "Alta",
        "stage_key": "alta",
        "base": "Relación contractual",
        "base_key": "contractual",
        "trigger": "contract_signed",
        "segment": "Cuenta con contrato registrado.",
        "permission": "Relación contractual; comunicación necesaria para orientar los próximos pasos.",
        "exclusions": "Excluir de captación general. Mantener solo comunicaciones contractuales/de servicio; nada promocional sin permiso de marketing.",
        "kpi": "Primer pedido confirmado (order_confirmed).",
        "subject": "Bienvenida y próximos pasos",
        "preheader": "Lo esencial para comenzar la relación de servicio.",
        "body": [
            "Recibes este correo como parte de la relación contractual de Marley Coffee Empresas con {{negocio}}.",
            "Hola {{nombre}}. Como {{comprador}}, puedes revisar el estado de la cuenta y los próximos pasos acordados. El detalle aplicable es el que figura en el contrato.",
            "Las condiciones comerciales se confirman en tu propuesta antes de formalizarlas.",
        ],
        "cta": "Revisar mi cuenta",
        "cta_slug": "revisar_cuenta",
        "destination": "../../index.html#C09",
        "unsubscribe": False,
    },
    {
        "id": "E07",
        "name": "Tu primera semana (por rol)",
        "stage": "Alta",
        "stage_key": "alta",
        "base": "Relación contractual",
        "base_key": "contractual",
        "trigger": "Días después del alta",
        "segment": "Cuenta recién dada de alta; contenido ajustado al rol comprador.",
        "permission": "Relación contractual; guía de incorporación del servicio.",
        "exclusions": "Excluir de captación general. Mantener solo comunicaciones contractuales/de servicio; nada promocional sin permiso de marketing.",
        "kpi": "Visita a los próximos pasos desde E07, atribuida por UTM; sin píxel.",
        "subject": "Tu primera semana, paso a paso",
        "preheader": "Una guía para revisar lo que corresponde a tu rol.",
        "body": [
            "Recibes este correo porque {{negocio}} está en la etapa inicial de su relación contractual con Marley Coffee Empresas.",
            "Hola {{nombre}}. Como {{comprador}}, aquí puedes revisar los próximos pasos relacionados con tu rol. Si una tarea o fecha no quedó acordada, confírmala con el equipo antes de contar con ella.",
        ],
        "cta": "Ver próximos pasos",
        "cta_slug": "ver_proximos_pasos",
        "destination": "../../index.html#C09",
        "unsubscribe": False,
    },
    {
        "id": "E08",
        "name": "Aviso de reposición",
        "stage": "Deleite",
        "stage_key": "deleite",
        "base": "Servicio",
        "base_key": "servicio",
        "trigger": "Cadencia o consumo estimado",
        "segment": "Cuenta activa con cadencia o consumo estimado para revisar.",
        "permission": "Servicio asociado a la cuenta; no es una campaña promocional.",
        "exclusions": "Excluir de captación general. Mantener solo avisos de servicio; pausar si existe una incidencia abierta.",
        "kpi": "Pedido repetido confirmado (repeat_order_confirmed).",
        "subject": "Aviso de reposición para tu negocio",
        "preheader": "Revisa la cadencia o el consumo estimado de tu cuenta.",
        "body": [
            "Recibes este aviso de servicio según la cadencia o el consumo estimado asociado a tu cuenta.",
            "Hola {{nombre}}. Revisa {{producto}} y la cantidad sugerida de {{cantidad_sugerida}} para {{negocio}}. La cadencia registrada es {{cadencia}}; confirma los datos antes de pedir. Esta referencia no es un pedido confirmado ni reemplaza la validación del equipo.",
            "Como {{comprador}}, puedes revisar la reposición desde tu cuenta.",
        ],
        "cta": "Revisar reposición",
        "cta_slug": "revisar_reposicion",
        "destination": "../../index.html#C09",
        "unsubscribe": False,
    },
    {
        "id": "E09",
        "name": "Novedades para tu negocio",
        "stage": "Deleite",
        "stage_key": "deleite",
        "base": "Permiso de marketing",
        "base_key": "marketing",
        "trigger": "Calendario editorial",
        "segment": "Comprador con permiso de marketing vigente; contenido por tipo de negocio.",
        "permission": "Permiso de marketing afirmativo y vigente.",
        "exclusions": "Clientes activos excluidos de captación general; excluir sin permiso, tras baja u oposición. La comunicación sigue siendo promocional.",
        "kpi": "Visitas al contenido atribuibles a E09 mediante UTM; sin píxel.",
        "subject": "Novedades para tu negocio",
        "preheader": "Información de Marley Coffee Empresas para revisar cuando te sirva.",
        "body": [
            "Recibes estas novedades porque aceptaste comunicaciones de marketing de Marley Coffee Empresas.",
            "Hola {{nombre}}. Aquí encontrarás contenido para quien compra y opera en {{negocio}}. Como {{comprador}}, puedes revisar las novedades cuando te sirva.",
            "Los precios y las condiciones comerciales se confirman en tu propuesta.",
        ],
        "cta": "Ver novedades",
        "cta_slug": "ver_novedades",
        "destination": "../contenidos/index.html",
        "unsubscribe": True,
    },
    {
        "id": "E10",
        "name": "¿Cómo lo estamos haciendo?",
        "stage": "Deleite",
        "stage_key": "deleite",
        "base": "Servicio",
        "base_key": "servicio",
        "trigger": "Después de una entrega o de un caso",
        "segment": "Cuenta que registró una entrega o un caso de servicio.",
        "permission": "Servicio y evaluación de la experiencia asociada a una entrega o caso.",
        "exclusions": "Excluir de captación general. Mantener la solicitud de opinión como servicio; no usar la respuesta para promocionar sin permiso.",
        "kpi": "Encuestas respondidas (csat_submitted).",
        "subject": "¿Cómo lo estamos haciendo?",
        "preheader": "Queremos conocer tu experiencia tras la entrega o el caso.",
        "body": [
            "Recibes este correo después de una entrega o de un caso de servicio asociado a {{negocio}}.",
            "Hola {{nombre}}. Como {{comprador}}, ¿la información, coordinación y respuesta quedaron claras? Puedes contarnos qué funcionó o qué quedó pendiente.",
            "No incluyas datos sensibles en tu respuesta.",
        ],
        "cta": "Contar mi experiencia",
        "cta_slug": "contar_experiencia",
        "destination": "../../index.html#C09",
        "unsubscribe": False,
    },
    {
        "id": "E11",
        "name": "Recomienda a otro negocio",
        "stage": "Deleite",
        "stage_key": "deleite",
        "base": "Permiso de marketing",
        "base_key": "marketing",
        "trigger": "propuesta inicial, a validar con Ventas: ofrecer recomendación solo con 9 o 10 en la pregunta de 0 a 10 (definición estándar de promotor).",
        "segment": "Cliente con respuesta 9 o 10 en la pregunta de 0 a 10 y permiso de marketing vigente.",
        "permission": "Permiso de marketing afirmativo y vigente, además de una respuesta 9 o 10 en la pregunta de 0 a 10.",
        "exclusions": "Excluir clientes activos de campañas de captación general, sin perjuicio de esta invitación. Excluir sin permiso, tras baja u oposición.",
        "kpi": "Referidos enviados (referral_sent), solo si la acción se instrumenta y confirma.",
        "subject": "Recomienda a otro negocio",
        "preheader": "Comparte esta información si crees que puede servir.",
        "body": [
            "Recibes esta invitación porque compartiste una experiencia favorable y aceptaste comunicaciones de marketing.",
            "Hola {{nombre}}. Si conoces a alguien que compra para otro negocio, puedes compartirle la información para que la revise por su cuenta. Como {{comprador}} de {{negocio}}, decides si te sirve hacer esa recomendación.",
            "No se ofrece una recompensa: el prototipo no tiene un incentivo de referidos definido.",
        ],
        "cta": "Abrir página para compartir",
        "cta_slug": "abrir_pagina_para_compartir",
        "destination": "../soluciones/index.html",
        "unsubscribe": True,
    },
    {
        "id": "E12",
        "name": "Te echamos de menos",
        "stage": "Reactivación",
        "stage_key": "reactivacion",
        "base": "Permiso de marketing",
        "base_key": "marketing",
        "trigger": "propuesta inicial, a validar con Ventas: sin pedidos durante el doble de la cadencia habitual de reposición de la cuenta.",
        "segment": "Cuenta sin pedidos durante el doble de su cadencia habitual de reposición.",
        "permission": "Permiso de marketing afirmativo y vigente.",
        "exclusions": "Excluir cuentas activas y clientes que ya retomaron pedidos; excluir sin permiso, tras baja u oposición.",
        "kpi": "Pedidos repetidos confirmados después de E12 (repeat_order_confirmed).",
        "subject": "Si quieres, revisamos tu cuenta",
        "preheader": "Puedes volver a conversar cuando te haga sentido.",
        "body": [
            "Recibes este correo porque el período configurado para reactivación no registra pedidos de {{negocio}}.",
            "Hola {{nombre}}. Si ahora quieres revisar tu situación, como {{comprador}} puedes volver al portal y pedir una conversación con el equipo.",
            "Si necesitas revisar precios o condiciones, se confirman en tu propuesta.",
        ],
        "cta": "Revisar mi cuenta",
        "cta_slug": "revisar_cuenta",
        "destination": "../../index.html#C09",
        "unsubscribe": True,
    },
]


VISUALS = {
    "E01": {
        "eyebrow": "Tu solicitud",
        "hero": "Guardamos tu avance",
        "highlight": "avance",
        "facts": [
            ("N.º de seguimiento", "{{numero}}"),
            ("Negocio", "{{negocio}}"),
            ("Siguiente paso", "Completar los 3 pasos"),
            ("Condiciones", "Se confirman en tu propuesta"),
        ],
    },
    "E02": {
        "eyebrow": "Propuesta enviada",
        "hero": "Tu propuesta está lista",
        "highlight": "propuesta",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Propuesta", "{{quote_id}} · v{{quote_version}}"),
            ("Producto / cantidad", "{{producto}} · {{cantidad_sugerida}}"),
            ("Condiciones", "Se confirman en tu propuesta"),
        ],
    },
    "E03": {
        "eyebrow": "Recordatorio",
        "hero": "Tu propuesta te espera",
        "highlight": "espera",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Propuesta", "{{quote_id}} · v{{quote_version}}"),
            ("Respuesta registrada", "Pendiente"),
            ("Condiciones", "Se confirman en tu propuesta"),
        ],
    },
    "E04": {
        "eyebrow": "Formulario iniciado",
        "hero": "Retoma tu solicitud",
        "highlight": "solicitud",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Comprador", "{{comprador}}"),
            ("Paso 1", "Enviado"),
            ("Siguiente paso", "Completar el paso 2"),
        ],
    },
    "E05": {
        "eyebrow": "Guía para decidir",
        "hero": "Cuentas claras",
        "highlight": "claras",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Producto", "{{producto}}"),
            ("Cantidad sugerida", "{{cantidad_sugerida}}"),
            ("Condiciones", "Se confirman en tu propuesta"),
        ],
    },
    "E06": {
        "eyebrow": "Relación contractual",
        "hero": "Bienvenida",
        "highlight": "Bienvenida",
        "facts": [
            ("Contrato", "{{contract_id}}"),
            ("Cuenta", "{{account_id}}"),
            ("Negocio", "{{negocio}}"),
            ("Estado", "Contrato firmado"),
        ],
    },
    "E07": {
        "eyebrow": "Una guía para tu rol",
        "hero": "Tu primera semana",
        "highlight": "semana",
        "facts": [
            ("Contrato", "{{contract_id}}"),
            ("Cuenta", "{{account_id}}"),
            ("Negocio", "{{negocio}}"),
            ("Rol", "{{comprador}}"),
        ],
    },
    "E08": {
        "eyebrow": "Aviso de servicio",
        "hero": "Aviso de reposición",
        "highlight": "reposición",
        "facts": [
            ("Producto", "{{producto}}"),
            ("Cantidad sugerida", "{{cantidad_sugerida}}"),
            ("Cadencia", "{{cadencia}}"),
            ("Cómo pedir", "Desde tu cuenta, en 2 toques"),
        ],
    },
    "E09": {
        "eyebrow": "Contenido para empresas",
        "hero": "Novedades",
        "highlight": "Novedades",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Comprador", "{{comprador}}"),
            ("Producto", "{{producto}}"),
            ("Tema", "Café para empresas"),
        ],
    },
    "E10": {
        "eyebrow": "Después de una entrega o caso",
        "hero": "Tu experiencia",
        "highlight": "experiencia",
        "facts": [
            ("Caso", "{{case_id}}"),
            ("Tipo", "{{tipo}}"),
            ("Qué evaluamos", "Atención · escala de 1 a 5"),
            ("Cuánto toma", "No hay tiempo estimado"),
        ],
    },
    "E11": {
        "eyebrow": "Invitación a compartir",
        "hero": "Recomienda",
        "highlight": "Recomienda",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Comprador", "{{comprador}}"),
            ("Para compartir", "Información de Marley Coffee Empresas"),
            ("Recompensa", "No hay recompensa definida"),
        ],
    },
    "E12": {
        "eyebrow": "Volver a conversar",
        "hero": "Revisar tu cuenta",
        "highlight": "cuenta",
        "facts": [
            ("Negocio", "{{negocio}}"),
            ("Producto", "{{producto}}"),
            ("Cadencia habitual", "{{cadencia}}"),
            ("Siguiente paso", "Pedir una conversación"),
        ],
    },
}


def make_logo() -> None:
    if not LOGO_SOURCE.exists():
        raise FileNotFoundError(f"No existe el logo fuente: {LOGO_SOURCE}")
    source = Image.open(LOGO_SOURCE).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 0 if value < 10 else value)
    white = Image.new("RGBA", source.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    LOGO_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    white.save(LOGO_OUTPUT, "PNG", optimize=True)


def track_url(item: dict[str, str]) -> str:
    parts = urlsplit(item["destination"])
    query = urlencode(
        {
            "utm_source": "email",
            "utm_medium": "email",
            "utm_campaign": item["id"],
            "utm_content": item["cta_slug"],
        }
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def render_facts(item: dict[str, str]) -> str:
    rows = []
    for label, value in VISUALS[item["id"]]["facts"]:
        rows.append(
            f'''<tr>
  <td width="43%" valign="top" class="email-facts-label" style="width:43%;padding:11px 8px 11px 0;border-bottom:1px dotted #9A9A9A;color:#4A4A4A;font-family:Pressura,'Trebuchet MS',Arial,sans-serif;font-size:10px;line-height:1.45;letter-spacing:.07em;text-transform:uppercase;overflow-wrap:anywhere;">{escape(label)}</td>
  <td width="57%" align="right" valign="top" class="email-facts-value" style="width:57%;padding:11px 0;border-bottom:1px dotted #9A9A9A;color:#171717;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;line-height:1.45;overflow-wrap:anywhere;">{escape(value)}</td>
</tr>'''
        )
    return f'''<table role="presentation" class="email-facts" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
  <tr><td colspan="2" style="padding:20px 0 7px;border-top:1px solid #D8D8D8;color:#4A4A4A;font-family:Pressura,'Trebuchet MS',Arial,sans-serif;font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;">Cuentas claras</td></tr>
  {''.join(rows)}
</table>'''


def render_hero(visual: dict[str, str]) -> str:
    hero = visual["hero"]
    highlight = visual["highlight"]
    matches = list(re.finditer(re.escape(highlight), hero, flags=re.IGNORECASE))
    if len(matches) != 1:
        raise ValueError(f"El titular debe incluir una sola palabra resaltada: {hero!r}")
    match = matches[0]
    before = escape(hero[:match.start()])
    marked = escape(match.group(0))
    after = escape(hero[match.end():])
    return (
        f'{before}<span class="email-hero-highlight" '
        'style="display:inline-block;padding:0 .08em;background-color:#F3C900;color:#171717;">'
        f'{marked}</span>{after}'
    )


def render_email(item: dict[str, str], template: str) -> str:
    visual = VISUALS[item["id"]]
    paragraphs = "\n".join(
        f'<p style="margin:0 0 17px;color:#292929;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;overflow-wrap:anywhere;">{escape(text)}</p>'
        for text in item["body"]
    )
    if item["unsubscribe"]:
        unsubscribe = (
            f'<p style="margin:12px 0 0;">¿Prefieres no recibir promociones? '
            f'<a href="bandeja.html?baja={item["id"]}#baja" style="display:inline-flex;min-height:44px;max-width:100%;box-sizing:border-box;align-items:center;vertical-align:middle;color:#171717;line-height:1.3;text-decoration:underline;overflow-wrap:anywhere;">Darte de baja de marketing</a>. '
            "En este prototipo no se guarda ninguna preferencia.</p>"
        )
    else:
        unsubscribe = ""
    replacements = {
        "{{SUBJECT}}": escape(item["subject"]),
        "{{PREHEADER}}": escape(item["preheader"]),
        "{{EYEBROW}}": escape(visual["eyebrow"]),
        "{{HERO}}": render_hero(visual),
        "{{BODY_HTML}}": paragraphs,
        "{{FACTS_HTML}}": render_facts(item),
        "{{CTA_URL}}": escape(track_url(item), quote=True),
        "{{CTA_LABEL}}": escape(item["cta"]),
        "{{UNSUBSCRIBE_HTML}}": unsubscribe,
    }
    result = template
    for token, value in replacements.items():
        result = result.replace(token, value)
    return result


def personalization_tokens(item: dict[str, str]) -> list[str]:
    source = "\n".join(item["body"] + [f"{label} {value}" for label, value in VISUALS[item["id"]]["facts"]])
    found = list(dict.fromkeys(re.findall(r"\{\{[^{}]+\}\}", source)))
    common = ["{{nombre}}", "{{negocio}}", "{{comprador}}"]
    return [token for token in common if token in found] + [token for token in found if token not in common]


def build_ficha() -> str:
    out = [
        "# Ficha de correos · Marley Coffee Empresas",
        "",
        "Prototipo académico de ciclo de vida. Los mensajes son muestras locales: no se envían ni registran aperturas. No contienen datos reales ni píxeles de seguimiento.",
        "",
        "## Reglas comunes",
        "",
        "- Cada correo declara los tokens de CRM que usa en su ficha; los campos disponibles se completan desde la solicitud, la propuesta, la cuenta o el caso correspondiente.",
        "- Supresión de captación: los clientes activos salen de la captación general. Los correos contractuales y de servicio se conservan solo para su finalidad; los promocionales requieren permiso de marketing vigente.",
        "- Los correos E04, E05, E09, E11 y E12 incluyen un enlace de baja. En el prototipo, la baja solo muestra una confirmación; no guarda una preferencia real.",
        "- No se fijan precios, plazos, condiciones comerciales ni incentivos. Los criterios de envío E03, E11 y E12 son «propuesta inicial, a validar con Ventas»: reglas internas, no promesas al cliente.",
        "- Antes de cualquier lanzamiento, verificar la fecha de entrada en vigor de la Ley 21.719 y si existe una posible postergación.",
        "- El CTA de cada correo usa `utm_source=email&utm_medium=email&utm_campaign=<ID>&utm_content=<slug_del_CTA>`.",
        "",
        "## Mapa de mensajes",
        "",
    ]
    for item in EMAILS:
        visual = VISUALS[item["id"]]
        fields = ", ".join(f"`{token}`" for token in personalization_tokens(item))
        facts = "; ".join(f"{label} · {value}" for label, value in visual["facts"])
        trigger = item["trigger"]
        trigger_display = trigger if trigger.endswith((".", "!", "?", ";")) else f"{trigger}."
        out.extend(
            [
                f'### {item["id"]} · {item["name"]}',
                "",
                f'- **Etapa:** {item["stage"]}.',
                f'- **Asunto ({len(item["subject"])} caracteres):** {item["subject"]}',
                f'- **Texto previo ({len(item["preheader"])} caracteres):** {item["preheader"]}',
                f'- **Gancho visual:** {visual["eyebrow"]}.',
                f'- **Titular del héroe:** {visual["hero"]}.',
                f'- **Palabra resaltada:** {visual["highlight"]}.',
                f'- **Ficha Cuentas claras:** {facts}.',
                f'- **Disparador:** {trigger_display}',
                f'- **Segmento:** {item["segment"]}',
                f'- **Campos personalizables:** {fields}.',
                f'- **Base de permiso:** {item["base"]}. {item["permission"]}',
                f'- **Exclusiones:** {item["exclusions"]}',
                f'- **Indicador principal:** {item["kpi"]}',
                f'- **CTA:** {item["cta"]}.',
                f'- **UTM del CTA:** `{track_url(item)}`',
                f'- **Por qué lo recibe:** {item["body"][0]}',
                "",
            ]
        )
    out.extend(
        [
            "## Plantilla y revisión",
            "",
            "`PLANTILLA.html` es la base de tablas para correo, con estilos inline, media query embebida y sin hojas de estilo externas. El héroe usa Festivo a 48 px en escritorio y 36 px en móvil; Pressura y Festivo declaran familias de respaldo para correo.",
            "",
            "`recursos/marley-email-blanco.png` se genera desde `recursos/marca/logo.webp` con Python/Pillow, preservando transparencia y recoloreando la marca para el encabezado negro.",
            "",
            "E10 no publica un tiempo estimado: el CRM y el formulario del portal no definen cuánto toma la evaluación.",
            "",
            "El enlace de baja dirige a `bandeja.html?baja=<ID>`. La pantalla confirma que es una simulación y no cambia una lista de contactos.",
            "",
            "Antes de activar E03, E11 o E12, Ventas debe validar los parámetros iniciales de envío indicados en sus fichas y deben revisarse las bases legales vigentes.",
            "",
        ]
    )
    return "\n".join(out)


def build_ficha_page() -> str:
    sections = []
    for item in EMAILS:
        visual = VISUALS[item["id"]]
        fields = ", ".join(f'<code>{escape(token)}</code>' for token in personalization_tokens(item))
        facts = "".join(
            f'<tr><th scope="row">{escape(label)}</th><td>{escape(value)}</td></tr>'
            for label, value in visual["facts"]
        )
        sections.append(
            f'''<article class="ficha-card" id="{item['id']}">
  <header class="ficha-card__head"><p>{item['id']} · {escape(item['stage'])}</p><h2>{escape(item['name'])}</h2></header>
  <dl>
    <div><dt>Asunto</dt><dd>{escape(item['subject'])}</dd></div>
    <div><dt>Texto previo</dt><dd>{escape(item['preheader'])}</dd></div>
    <div><dt>Gancho visual</dt><dd>{escape(visual['eyebrow'])}</dd></div>
    <div><dt>Titular del héroe</dt><dd>{escape(visual['hero'])}</dd></div>
    <div><dt>Palabra resaltada</dt><dd>{escape(visual['highlight'])}</dd></div>
    <div><dt>Disparador</dt><dd>{escape(item['trigger'])}</dd></div>
    <div><dt>Segmento</dt><dd>{escape(item['segment'])}</dd></div>
    <div><dt>Campos personalizables</dt><dd>{fields}.</dd></div>
    <div><dt>Base de permiso</dt><dd>{escape(item['base'])}. {escape(item['permission'])}</dd></div>
    <div><dt>Exclusiones</dt><dd>{escape(item['exclusions'])}</dd></div>
    <div><dt>Indicador principal</dt><dd>{escape(item['kpi'])}</dd></div>
    <div><dt>CTA</dt><dd>{escape(item['cta'])}</dd></div>
    <div><dt>UTM del CTA</dt><dd><code>{escape(track_url(item))}</code></dd></div>
  </dl>
  <table class="ficha-facts" aria-label="Ficha Cuentas claras"><thead><tr><th colspan="2">Cuentas claras</th></tr></thead><tbody>{facts}</tbody></table>
  <p class="ficha-card__why">{escape(item['body'][0])}</p>
  <a class="ficha-back" href="bandeja.html">Volver a la bandeja</a>
</article>'''
        )
    return f'''<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230B0B0C'/%3E%3Cpath fill='%23F3C900' d='M12 16h40v32H12z'/%3E%3C/svg%3E">
  <title>Fichas de correo · Marley Coffee Empresas</title>
  <link rel="stylesheet" href="../marca/negro-marley.css">
  <style>
    .fichas{{padding:26px 0 56px}}
    .fichas__header{{display:flex;align-items:center;gap:16px;margin-bottom:22px}}
    .fichas__header img{{width:64px;height:64px;object-fit:contain}}
    .fichas__header p{{margin:0 0 6px;color:var(--nm-oro);font:500 .8rem/1.3 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}}
    .fichas__header h1{{margin:0;color:#FFFFFF;font-family:Festivo,'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-size:48px;font-stretch:condensed;font-weight:700;line-height:.95;text-transform:uppercase;overflow-wrap:anywhere}}
    .fichas__notice{{margin:0 0 20px;padding:14px 16px;border-left:4px solid #F3C900;background:#FFFFFF;color:#171717;line-height:1.5}}
    .ficha-list{{display:grid;gap:18px}}
    .ficha-card{{scroll-margin-top:16px;padding:24px;background:#FFFFFF;color:#171717;border:1px solid #E2E2E2;border-radius:8px;overflow-wrap:anywhere}}
    .ficha-card__head p{{margin:0 0 8px;color:#4A4A4A;font:500 .78rem/1.3 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}}
    .ficha-card h2{{margin:0 0 18px;color:#171717;font:500 1.6rem/1.1 Festivo,'Arial Narrow',Impact,sans-serif;text-transform:uppercase}}
    .ficha-card dl{{display:grid;gap:10px;margin:0}}
    .ficha-card dl div{{display:grid;grid-template-columns:minmax(150px,190px) minmax(0,1fr);gap:12px;padding-top:10px;border-top:1px solid #E2E2E2}}
    .ficha-card dt{{color:#4A4A4A;font:500 .75rem/1.35 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase}}
    .ficha-card dd{{margin:0;color:#171717;line-height:1.5}}
    .ficha-facts{{width:100%;margin:18px 0;border-collapse:collapse;table-layout:fixed}}
    .ficha-facts thead th{{padding:10px 0;text-align:left;color:#4A4A4A;font:500 .72rem/1.3 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase;border-top:1px solid #D8D8D8}}
    .ficha-facts tbody th{{width:43%;padding:9px 8px 9px 0;text-align:left;color:#4A4A4A;font:500 .65rem/1.4 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px dotted #9A9A9A;overflow-wrap:anywhere}}
    .ficha-facts tbody td{{width:57%;padding:9px 0;text-align:right;color:#171717;font:600 .84rem/1.4 Arial,Helvetica,sans-serif;border-bottom:1px dotted #9A9A9A;overflow-wrap:anywhere}}
    .ficha-card code{{font-family:Consolas,'Courier New',monospace;font-size:.88em;overflow-wrap:anywhere}}
    .ficha-card__why{{margin:18px 0;color:#4A4A4A;font-size:.92rem;line-height:1.5}}
    .ficha-back{{display:inline-flex;min-height:44px;align-items:center;color:#171717;text-decoration:underline;font-weight:600}}
    @media(max-width:620px){{.fichas{{padding-top:18px}}.fichas__header h1{{font-size:36px}}.ficha-card{{padding:17px}}.ficha-card dl div{{grid-template-columns:1fr;gap:3px}}.ficha-facts tbody th{{font-size:.59rem}}.ficha-facts tbody td{{font-size:.76rem}}}}
  </style>
</head>
<body class="nm">
  <main class="nm-wrap fichas">
    <header class="fichas__header"><img src="recursos/marley-email-blanco.png" width="64" height="64" alt="Marley Coffee"><div><p>Marley Coffee · Empresas</p><h1>Fichas de correo</h1></div></header>
    <p class="fichas__notice">E03, E11 y E12: propuesta inicial, a validar con Ventas. Son reglas internas de envío, no promesas al cliente.</p>
    <p class="fichas__notice">E10 no incluye un tiempo estimado: no hay una duración definida en el CRM ni en el formulario del portal.</p>
    <div class="ficha-list">{''.join(sections)}</div>
  </main>
</body>
</html>'''


def build_inbox() -> str:
    cards = []
    for item in EMAILS:
        cards.append(
            f'''<article class="mail-card" data-stage="{item['stage_key']}" data-base="{item['base_key']}">
  <div class="mail-card__top"><span class="mail-card__id">{item['id']}</span><span class="mail-card__stage">{escape(item['stage'])}</span></div>
  <h2>{escape(item['name'])}</h2>
  <p class="mail-card__subject"><strong>Asunto:</strong> {escape(item['subject'])}</p>
  <p class="mail-card__preview">{escape(item['preheader'])}</p>
  <dl class="mail-card__meta"><div><dt>Base</dt><dd>{escape(item['base'])}</dd></div><div><dt>Disparador</dt><dd>{escape(item['trigger'])}</dd></div></dl>
  <div class="mail-card__actions"><a class="nm-btn" href="{item['id']}.html">Abrir correo</a><a class="mail-card__sheet" href="fichas.html#{item['id']}">Ver ficha</a></div>
</article>'''
        )
    return f'''<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230B0B0C'/%3E%3Cpath fill='%23F3C900' d='M12 16h40v32H12z'/%3E%3C/svg%3E">
  <title>Bandeja de correos · Marley Coffee Empresas</title>
  <link rel="stylesheet" href="../marca/negro-marley.css">
  <style>
    .mailbox{{padding:28px 0 56px}}
    .mailbox-header{{display:flex;align-items:center;gap:18px;margin:0 0 26px}}
    .mailbox-header img{{width:72px;height:72px;object-fit:contain}}
    .mailbox-header h1{{margin:0;color:#FFFFFF;font-family:Festivo,'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-size:52px;font-stretch:condensed;font-weight:700;line-height:.94;text-transform:uppercase;overflow-wrap:anywhere}}
    .mailbox-header p{{margin:0 0 8px;color:var(--nm-oro);font:500 .8rem/1.3 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}}
    .mailbox-intro{{max-width:760px;margin:0 0 22px;color:var(--nm-humo)}}
    .mailbox-intro p{{margin:0 0 10px}}
    .mailbox-alert{{margin:0 0 18px;padding:14px 16px;background:#FFFFFF;color:#171717;border-left:4px solid #F3C900;border-radius:4px}}
    .mailbox-alert[hidden]{{display:none}}
    .mailbox-filters{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;max-width:720px;padding:18px;background:var(--nm-carbon);border:1px solid var(--nm-linea);border-radius:8px}}
    .mailbox-filters label{{display:grid;gap:7px;color:var(--nm-hueso);font:500 .78rem/1.3 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}}
    .mailbox-filters select{{width:100%;min-height:48px;padding:10px 12px;border:1px solid #8F8B81;border-radius:5px;background:#FFFFFF;color:#171717;font:400 16px/1.3 Arial,Helvetica,sans-serif}}
    .mailbox-count{{margin:16px 0 10px;color:#FFFFFF;font-weight:600}}
    .mail-list{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
    .mail-card{{min-width:0;padding:20px;background:#FFFFFF;color:#171717;border:1px solid #E2E2E2;border-radius:8px;overflow-wrap:anywhere}}
    .mail-card[hidden]{{display:none}}
    .mail-card__top{{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}}
    .mail-card__id{{color:#171717;font:500 .85rem/1 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.1em}}
    .mail-card__stage{{padding:5px 8px;border:1px solid #D0D0D0;border-radius:4px;color:#444;font:500 .72rem/1.2 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}}
    .mail-card h2{{margin:0 0 12px;color:#171717;font-family:Festivo,'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-size:27px;font-stretch:condensed;font-weight:700;line-height:.98;text-transform:uppercase;overflow-wrap:anywhere}}
    .mail-card__subject,.mail-card__preview{{margin:0 0 8px;line-height:1.45}}
    .mail-card__preview{{color:#4A4A4A}}
    .mail-card__meta{{display:grid;gap:0;margin:16px 0}}
    .mail-card__meta div{{display:grid;grid-template-columns:94px minmax(0,1fr);gap:8px;align-items:baseline;padding:8px 0;border-bottom:1px dotted #AFAFAF}}
    .mail-card__meta dt{{color:#4A4A4A;font:500 .72rem/1.35 Pressura,'Trebuchet MS',Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase}}
    .mail-card__meta dd{{margin:0;color:#171717;font-size:.9rem;line-height:1.4}}
    .mail-card__actions{{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #E2E2E2}}
    .mail-card__actions .nm-btn{{min-height:48px;padding:13px 17px;border:1px solid #171717;background:#FFFFFF;color:#171717;text-decoration:none}}
    .mail-card__actions .nm-btn:hover{{background:#F5F5F5;border-color:#171717;color:#171717}}
    .mail-card__sheet{{min-height:44px;display:inline-flex;align-items:center;color:#171717;text-decoration:underline;font-weight:600}}
    .mailbox-footer{{max-width:780px;margin:28px 0 0;padding-top:18px;border-top:1px solid var(--nm-linea);color:var(--nm-humo);font-size:.9rem}}
    .mailbox-footer p{{margin:0 0 10px}}
    @media (max-width:700px){{
      .mailbox{{padding-top:20px}}
      .mailbox-header{{align-items:flex-start;gap:12px}}
      .mailbox-header img{{width:58px;height:58px}}
      .mailbox-header h1{{font-size:38px}}
      .mailbox-filters,.mail-list{{grid-template-columns:1fr}}
      .mailbox-filters{{padding:14px}}
      .mail-card{{padding:17px}}
      .mail-card__meta div{{grid-template-columns:88px minmax(0,1fr);gap:6px}}
    }}
    @media (max-width:480px){{.mailbox-header h1{{font-size:36px}}.mail-card h2{{font-size:25px}}.mail-card__meta dt{{font-size:.66rem}}.mail-card__meta dd{{font-size:.84rem}}}}
  </style>
</head>
<body class="nm">
  <main class="nm-wrap mailbox">
    <header class="mailbox-header">
      <img src="recursos/marley-email-blanco.png" width="72" height="72" alt="Marley Coffee">
      <div><p>Marley Coffee · Empresas</p><h1>Bandeja de correos</h1></div>
    </header>
    <section class="mailbox-intro" aria-label="Información de la bandeja">
      <p>Doce mensajes de muestra del recorrido E01 a E12. Abre el correo o consulta su ficha de permiso, segmento y disparador.</p>
      <p>E03, E11 y E12: propuesta inicial, a validar con Ventas. Son reglas internas de envío, no promesas al cliente.</p>
      <p>Los filtros solo ordenan esta vista local; no guardan preferencias ni activan envíos.</p>
    </section>
    <p class="mailbox-alert" id="baja" role="status" hidden></p>
    <form class="mailbox-filters" aria-label="Filtros de correos" onsubmit="return false">
      <label for="filtro-etapa">Filtrar por etapa
        <select id="filtro-etapa"><option value="">Todas las etapas</option><option value="interaccion">Interacción</option><option value="alta">Alta</option><option value="deleite">Deleite</option><option value="reactivacion">Reactivación</option></select>
      </label>
      <label for="filtro-base">Filtrar por base de permiso
        <select id="filtro-base"><option value="">Todas las bases</option><option value="solicitud">Seguimiento de la solicitud</option><option value="recordatorios">Permiso de recordatorios</option><option value="marketing">Permiso de marketing</option><option value="contractual">Relación contractual</option><option value="servicio">Servicio</option></select>
      </label>
    </form>
    <p class="mailbox-count" id="mailbox-count" aria-live="polite">12 correos visibles</p>
    <section class="mail-list" id="mail-list" aria-label="Correos del recorrido">
      {''.join(cards)}
    </section>
    <footer class="mailbox-footer">
      <p>Prototipo académico. No se envía ningún correo ni se guardan datos personales.</p>
      <p>Antes de lanzar, verificar la fecha de entrada en vigor de la Ley 21.719 y la posible postergación.</p>
      <p>La baja de promociones se representa solo en esta pantalla; no cambia una lista real.</p>
    </footer>
  </main>
  <script>
    (() => {{
      const stage = document.getElementById('filtro-etapa');
      const base = document.getElementById('filtro-base');
      const count = document.getElementById('mailbox-count');
      const cards = [...document.querySelectorAll('.mail-card')];
      const alert = document.getElementById('baja');
      const unsubscribeId = new URLSearchParams(location.search).get('baja');
      if (unsubscribeId) {{
        alert.hidden = false;
        alert.textContent = `Baja simulada para ${{unsubscribeId}}. En este prototipo no se guarda ninguna preferencia.`;
      }}
      const applyFilters = () => {{
        let visible = 0;
        for (const card of cards) {{
          const show = (!stage.value || card.dataset.stage === stage.value) && (!base.value || card.dataset.base === base.value);
          card.hidden = !show;
          if (show) visible += 1;
        }}
        count.textContent = `${{visible}} ${{visible === 1 ? 'correo visible' : 'correos visibles'}}`;
      }};
      stage.addEventListener('change', applyFilters);
      base.addEventListener('change', applyFilters);
    }})();
  </script>
</body>
</html>'''


def main() -> None:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    make_logo()
    if set(VISUALS) != {item["id"] for item in EMAILS}:
        raise ValueError("Cada correo debe tener una dirección visual definida")
    for item in EMAILS:
        if len(item["subject"]) > 50:
            raise ValueError(f"Asunto demasiado largo: {item['id']} ({len(item['subject'])})")
        if len(item["preheader"]) > 90:
            raise ValueError(f"Texto previo demasiado largo: {item['id']} ({len(item['preheader'])})")
        if len(item["body"]) > 3:
            raise ValueError(f"Más de tres párrafos: {item['id']}")
        if not 3 <= len(VISUALS[item["id"]]["facts"]) <= 4:
            raise ValueError(f"Ficha Cuentas claras fuera de rango: {item['id']}")
        (ROOT / f"{item['id']}.html").write_text(render_email(item, template), encoding="utf-8")
    (ROOT / "bandeja.html").write_text(build_inbox(), encoding="utf-8")
    (ROOT / "fichas.html").write_text(build_ficha_page(), encoding="utf-8")
    (ROOT / "FICHA.md").write_text(build_ficha(), encoding="utf-8")
    print(f"Generados {len(EMAILS)} correos, bandeja y ficha en {ROOT}")
    print(f"Logo PNG: {LOGO_OUTPUT} ({LOGO_OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
