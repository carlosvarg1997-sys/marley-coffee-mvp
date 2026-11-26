'use strict';
// Corre, una tras otra, los 11 verificadores existentes y la matriz de verify-ux-final contra el servidor de pruebas.
//
// Uso (desde la carpeta del repositorio):
//   node qa/correr-matriz.cjs                    puerto 8907; si no responde, levanta qa/servir-qa.py
//   node qa/correr-matriz.cjs --puerto=8919      otro puerto
//   node qa/correr-matriz.cjs --estricto         lo pendiente cuenta como falla en verify-ux-final
//
// Una matriz a la vez: un archivo de bloqueo en la carpeta de evidencia impide dos corridas al mismo tiempo.
// Salidas, fuera del repositorio: <evidencia>/matriz-<fecha>/ con .out y .err por verificador, resumen.txt
// y el informe de verify-ux-final (informe-ux-final.json y capturas).

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const EVIDENCIA = path.resolve(process.env.MARLEY_UX_FINAL_BASE || path.join(RAIZ, '..', 'marley-final-26nov-evidencia'));
const opciones = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [clave, valor = 'si'] = a.slice(2).split('=');
  return [clave, valor];
}));
const PUERTO = Number(opciones.puerto || 8907);
const BASE = `http://127.0.0.1:${PUERTO}`;

function responde(url) {
  return new Promise((resolver) => {
    const req = http.get(url, (res) => { res.resume(); resolver(res.statusCode === 200); });
    req.setTimeout(3000, () => { req.destroy(); resolver(false); });
    req.on('error', () => resolver(false));
  });
}

// Comprueba que el servidor que responde en el puerto es el de este repositorio (sirve qa/servir-qa.py).
function esNuestro() {
  return new Promise((resolver) => {
    const req = http.get(`${BASE}/qa/servir-qa.py`, (res) => {
      let cuerpo = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { cuerpo += t; });
      res.on('end', () => resolver(res.statusCode === 200 && cuerpo.includes('Servidor de pruebas de Marley Coffee')));
    });
    req.setTimeout(3000, () => { req.destroy(); resolver(false); });
    req.on('error', () => resolver(false));
  });
}

async function asegurarServidor() {
  if (await esNuestro()) return null;
  if (await responde(`${BASE}/index.html`)) throw new Error(`El puerto ${PUERTO} lo usa otro proceso; elige otro con --puerto=`);
  const script = path.join(__dirname, 'servir-qa.py');
  const python = process.env.MARLEY_QA_PYTHON;
  const argumentos = python ? [script, String(PUERTO)] : ['-3.12', script, String(PUERTO)];
  const proceso = spawn(python || 'py', argumentos, { stdio: 'ignore', windowsHide: true });
  let fallo = null;
  proceso.once('error', (error) => { fallo = error; });
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (fallo || proceso.exitCode !== null) break;
    if (await esNuestro()) return proceso;
  }
  if (proceso.pid && proceso.exitCode === null) proceso.kill();
  throw new Error(`No pude levantar el servidor en ${BASE} con qa/servir-qa.py${fallo ? ` (${fallo.message})` : ''}`);
}

function bloquear(carpeta) {
  const archivo = path.join(carpeta, '.matriz.lock');
  if (fs.existsSync(archivo)) {
    const pid = Number(fs.readFileSync(archivo, 'utf8'));
    let vivo = false;
    try { process.kill(pid, 0); vivo = true; } catch (_) { vivo = false; }
    if (vivo) throw new Error(`Ya corre otra matriz (PID ${pid}). Espera a que termine: no se corren dos a la vez.`);
  }
  fs.writeFileSync(archivo, String(process.pid));
  return () => fs.rmSync(archivo, { force: true });
}

function correr(nombre, comando, argumentos, entorno, carpeta) {
  return new Promise((resolver) => {
    const inicio = Date.now();
    const salida = fs.openSync(path.join(carpeta, `${nombre}.out`), 'w');
    const error = fs.openSync(path.join(carpeta, `${nombre}.err`), 'w');
    const proceso = spawn(comando, argumentos, { cwd: RAIZ, env: { ...process.env, ...entorno }, stdio: ['ignore', salida, error], windowsHide: true });
    const limite = nombre === 'ux-final' ? 30 * 60_000 : 6 * 60_000;
    let agotado = false;
    const reloj = setTimeout(() => {
      agotado = true;
      proceso.kill();
    }, limite);
    proceso.on('error', (e) => fs.writeSync(error, e.message + '\n'));
    proceso.on('close', (codigo) => {
      clearTimeout(reloj);
      fs.closeSync(salida);
      fs.closeSync(error);
      const linea = `${nombre} exit=${codigo} segundos=${Math.round((Date.now() - inicio) / 1000)}${agotado ? ' tiempo agotado' : ''}`;
      fs.appendFileSync(path.join(carpeta, 'resumen.txt'), linea + '\n');
      process.stdout.write(linea + '\n');
      resolver(codigo);
    });
  });
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const carpeta = path.join(EVIDENCIA, `matriz-${stamp}`);
  fs.mkdirSync(carpeta, { recursive: true });
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  const soltar = bloquear(EVIDENCIA);
  let servidor = null;
  try {
    servidor = await asegurarServidor();
    process.stdout.write(`servidor ${BASE} ${servidor ? `levantado (PID ${servidor.pid})` : 'ya responde'}\n`);
    const b = `${BASE}`;
    const node = process.execPath;
    const corridas = [
      ['a8-portal', node, ['qa/verify-a8-portal.cjs', `${b}/`], { A8_VERIFY_OUT: path.join(carpeta, 'a8-portal') }],
      ['a1-final-a8-r3', node, ['qa/verify-a1-final-a8-r3.cjs', `${b}/`], { A1_FINAL_A8_R3_OUT: path.join(carpeta, 'a1-final-a8-r3') }],
      ['agente-conversacional', node, ['qa/verify-agente-conversacional.cjs', `${b}/`], { AGENTE_VERIFY_OUT: path.join(carpeta, 'agente-conversacional') }],
      ['crm-v2', node, ['qa/verify-crm-v2.cjs', `${b}/index.html`], { CRM2_VERIFY_OUT: path.join(carpeta, 'crm-v2') }],
      ['r6-crm', node, ['qa/verify-r6-crm.cjs', `${b}/index.html`], {}],
      ['r6-mkt-jefatura', node, ['qa/verify-r6-mkt-jefatura.cjs', `${b}/index.html`], {}],
      ['r6-puntaje', node, ['qa/verify-r6-puntaje.cjs', b], {}],
      ['r5-caminos', node, ['qa/verify-r5-caminos.cjs', b], {}],
      ['landing-w10', node, ['qa/verify-landing-w10.cjs', b], { W10_VERIFY_OUT: path.join(carpeta, 'landing-w10') }],
      ['prueba-final', node, ['qa/verify-prueba-final.cjs', `${b}/`, path.join(carpeta, 'prueba-final')], {}],
      ['piloto-premium', node, ['qa/verify-piloto-premium.cjs', b], { PILOTO_CLICK_OUT: path.join(carpeta, 'piloto-premium', 'verificacion.json') }],
      ['ux-final', node, ['qa/verify-ux-final.cjs', `${b}/`, ...(opciones.estricto ? ['--estricto'] : [])], { MARLEY_UX_FINAL_OUT: path.join(carpeta, 'ux-final') }],
    ];
    for (const [nombre, comando, argumentos, entorno] of corridas) {
      const codigo = await correr(nombre, comando, argumentos, entorno, carpeta);
      if (codigo !== 0) process.exitCode = 1;
    }
    fs.appendFileSync(path.join(carpeta, 'resumen.txt'), 'FIN\n');
    process.stdout.write(`Resultados: ${carpeta}\n`);
  } finally {
    if (servidor && servidor.exitCode === null) servidor.kill();
    soltar();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
