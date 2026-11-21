// Sustituye cada hueco [data-parte="x.html"] por el contenido de partes/x.html.
export async function cargarPartes() {
  const huecos = [...document.querySelectorAll("[data-parte]")];
  const textos = await Promise.all(huecos.map(async hueco => {
    const respuesta = await fetch(new URL(`../../partes/${hueco.dataset.parte}`, import.meta.url));
    if (!respuesta.ok) {
      throw new Error(`No se pudo cargar ${hueco.dataset.parte} (${respuesta.status}).`);
    }
    return respuesta.text();
  }));
  huecos.forEach((hueco, i) => {
    const plantilla = document.createElement("template");
    plantilla.innerHTML = textos[i];
    hueco.replaceWith(plantilla.content);
  });
}
