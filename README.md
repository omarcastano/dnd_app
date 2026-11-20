# D&D - La Taberna

Sitio estático de la taberna de D&D: tienda, cofres, robo, zonas, botín y puzzles. Al abrir se entra directo a la tienda. No necesita build: se publica tal cual desde `public/`.

## Estructura

```
DandD/
├─ personajes/      # Datos de personajes (JSON) e ilustraciones (imagenes/) por clase. Sin vista por ahora; no se publican
├─ public/          # Raíz del sitio publicado
│  ├─ index.html    # Redirige a la taberna (dungeons_and_dragons.html)
│  ├─ dungeons_and_dragons.html
│  └─ tienda/       # Tienda de la taberna (estilos.css, js/, partes/)
└─ narracion/       # Generador de audio con edge-tts (se ejecuta en la PC)
```

## Ejecutar en local

La tienda carga sus partes con `fetch`, así que no sirve abrir el HTML con doble clic. Usa un servidor local:

```bash
make run   # abrir http://localhost:8080
```

Requiere Node.js (para `npx`) y `make`. Para instalar `make` en Windows: `winget install ezwinports.make`. Para cambiar el puerto: `make run PORT=9000`.

## Publicación

### Cloudflare Pages

1. Conecta el repositorio en Cloudflare Pages y crea un proyecto de tipo Pages.
2. Configura el build:
   - **Build command:** (vacío)
   - **Build output directory:** `public`

### GitHub Pages

Las rutas son relativas, así que funciona en subruta (`https://usuario.github.io/DandD/`). GitHub Pages solo publica la raíz o `/docs`, así que hay que copiar `public/` a `docs/`.
