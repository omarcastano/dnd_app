// Sustituye cada hueco [data-parte="x.html"] por el contenido de partes/x.html.
// Si una parte no carga, su hueco muestra un aviso y las demás siguen: un fallo no tumba otras pestañas.
// Solo lanza error si no carga ninguna (p. ej. sin servidor).
export async function cargarPartes() {
  const huecos = [...document.querySelectorAll("[data-parte]")];
  const resultados = await Promise.allSettled(huecos.map(async hueco => {
    // no-cache: el navegador revalida con el servidor y nunca usa un fragmento viejo tras un cambio
    const respuesta = await fetch(new URL(`../../partes/${hueco.dataset.parte}`, import.meta.url), { cache: "no-cache" });
    if (!respuesta.ok) {
      throw new Error(`No se pudo cargar ${hueco.dataset.parte} (${respuesta.status}).`);
    }
    return respuesta.text();
  }));
  if (huecos.length && resultados.every(r => r.status === "rejected")) {
    throw resultados[0].reason;
  }
  huecos.forEach((hueco, i) => {
    const resultado = resultados[i];
    if (resultado.status === "rejected") {
      console.error(`[cargarPartes] ${hueco.dataset.parte}:`, resultado.reason);
      const aviso = document.createElement("p");
      aviso.className = "puzzle-message";
      aviso.textContent = resultado.reason?.message ?? `No se pudo cargar ${hueco.dataset.parte}.`;
      hueco.replaceWith(aviso);
      return;
    }
    const plantilla = document.createElement("template");
    plantilla.innerHTML = resultado.value;
    hueco.replaceWith(plantilla.content);
  });
}
