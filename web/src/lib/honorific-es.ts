/** Trato ilustrativo para textos de aparcería (demo; no sustituye datos legales). */
export function honorificForSpanishName(fullName: string): "Sra." | "Sr." {
  const raw = fullName.trim().split(/\s+/)[0] || "Socio";
  const w = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const male = new Set([
    "jose",
    "juan",
    "luis",
    "carlos",
    "pablo",
    "diego",
    "miguel",
    "antonio",
    "francisco",
    "manuel",
    "pedro",
    "javier",
    "jesus",
    "marcos",
    "raul",
    "sergio",
    "david",
    "jorge",
    "alberto",
    "ricardo",
    "fernando",
    "tony",
    "oscar",
    "roberto",
    "daniel",
    "andres",
    "mario",
    "vicente",
    "felipe",
    "enrique",
  ]);
  if (male.has(w)) return "Sr.";

  const female = new Set([
    "maria",
    "ana",
    "laura",
    "carmen",
    "rosa",
    "sofia",
    "elena",
    "patricia",
    "andrea",
    "monica",
    "paula",
    "lucia",
    "clara",
    "marta",
    "beatriz",
    "silvia",
    "cristina",
    "isabel",
    "dolores",
    "pilar",
  ]);
  if (female.has(w)) return "Sra.";

  if (w.endsWith("a") && w.length > 2 && !["luca", "noa", "joshua", "elias"].includes(w)) {
    return "Sra.";
  }
  return "Sr.";
}
