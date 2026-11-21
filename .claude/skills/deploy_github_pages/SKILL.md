---
name: deploy_github_pages
description: Despliega la app de D&D de La Taberna en GitHub Pages (https://omarcastano.github.io/dnd_app/). Haz commit y push a main, espera al workflow `Desplegar en GitHub Pages` y verifica que el sitio publicado responde. Úsala cuando el usuario pida desplegar, publicar o subir la app a Pages, o actualizar el sitio publicado.
---

# Desplegar en GitHub Pages

El despliegue es automático: cada `git push` a `main` ejecuta `.github/workflows/pages.yml`, que copia `public/` a `_sitio`, quita `public/personajes/{legacy,plantilla,*.py}` y lo publica. No hay build. Esta skill solo empuja los cambios y comprueba el resultado.

- Repo: `omarcastano/dnd_app` (público). Pages ya está activado con *Source: GitHub Actions*.
- URL del sitio: https://omarcastano.github.io/dnd_app/ (único enlace que hay que dar al usuario; los personajes son la pestaña Héroes).
- `gh` está en `~/.local/bin/gh` (si no aparece, usa la ruta completa). Si `gh auth status` no tiene sesión, pide al usuario `! gh auth login`; no leas tokens guardados en Git ni uses credenciales que no te dieron.

## Pasos

1. **Revisar el estado**: `git status --short` y `git log origin/main..HEAD --oneline`.
   - Solo se publica lo que está commiteado y subido. Muestra al usuario los cambios sin commitear y pregunta cuáles incluir; no hagas `git add -A` a ciegas.
   - Si hay cambios que desplegar, haz commit con mensaje claro en español (con la línea `Co-Authored-By` que indique el sistema) y `git push`. Hacer commit y push publica el sitio, así que el usuario debe haber pedido desplegar.
2. **Validar antes de subir** (opcional pero recomendado): `make check` valida las clases. Hoy falla con `plantilla: falta plantilla/plantilla.json` (error conocido que no afecta al despliegue); cualquier otro error sí hay que mirarlo.
3. **Esperar al workflow**: `gh run list --limit 1` hasta que `completed`. Si no arrancó (sin cambios nuevos), lánzalo con `gh workflow run pages.yml`. Tarda unos 20-30 s.
   - Si falla: `gh run view --log-failed`. Si `configure-pages` dice que Pages no está activado, el usuario debe poner *Settings → Pages → Source: GitHub Actions*.
4. **Verificar el sitio publicado** (con `curl -s -o /dev/null -w '%{http_code}'`):
   - `https://omarcastano.github.io/dnd_app/` → 200
   - `.../tienda/partes/heroes.html` y `.../personajes/clases.json` → 200
   - `.../personajes/legacy/` → 404 (no debe publicarse)
   - Si acabas de cambiar un archivo, compáralo con el local: `curl -s URL | cmp - archivo`.
5. **Informar**: estado del workflow, resultado de las comprobaciones y la URL. Si el usuario ve algo distinto a lo local, casi siempre es caché del navegador (`Ctrl+Shift+R` o incógnito); los archivos publicados son los del repo.

## Cuidados
- Nunca uses `force push` ni `pkill -f` con un patrón que aparezca en tu propio comando (mata el shell).
- Las rutas deben seguir siendo relativas: el sitio vive en la subruta `/dnd_app/`.
- Probar en local antes: `make run` → http://localhost:8080.
