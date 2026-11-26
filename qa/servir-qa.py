"""Servidor de pruebas de Marley Coffee (F · pruebas automáticas).

Sirve la copia del repositorio en http://127.0.0.1:<puerto>/, como
`py -3.12 -m http.server <puerto> --bind 127.0.0.1`, pero con una cola de
conexiones de 256. El servidor estándar tiene cola de 5 y rechaza conexiones
bajo carga (ERR_CONNECTION_REFUSED), y eso falsea las corridas de los verificadores.

Uso (desde cualquier carpeta):
    py -3.12 qa/servir-qa.py          # puerto 8907 (por omisión)
    py -3.12 qa/servir-qa.py 8919     # otro puerto
"""
import functools
import http.server
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent


class Servidor(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True
    # En Windows, SO_REUSEADDR deja que otro proceso comparta el puerto y reparta las peticiones
    # (así un proyecto ajeno respondió 404 a este servidor). Aquí el arranque debe fallar si el puerto está ocupado.
    allow_reuse_address = False


class Silencioso(http.server.SimpleHTTPRequestHandler):
    # Reutiliza conexiones en las matrices para evitar agotar los sockets de Windows.
    protocol_version = "HTTP/1.1"

    def log_message(self, formato, *args):
        pass


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8907
    manejador = functools.partial(Silencioso, directory=str(RAIZ))
    with Servidor(("127.0.0.1", puerto), manejador) as servidor:
        print(f"sirviendo {RAIZ} en http://127.0.0.1:{puerto}/", flush=True)
        servidor.serve_forever()


if __name__ == "__main__":
    main()
