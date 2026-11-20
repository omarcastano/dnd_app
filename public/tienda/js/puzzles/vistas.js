export function openPuzzle(id) {
  document.getElementById("puzzle-menu").style.display = "none";
  document.getElementById("view-" + id).style.display = "block";
}

export function closePuzzle() {
  document.querySelectorAll(".puzzle-view").forEach(view => { view.style.display = "none"; });
  document.getElementById("puzzle-menu").style.display = "";
}
