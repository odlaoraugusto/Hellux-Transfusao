/** Datas no fuso do navegador, no formato AAAA-MM-DD usado nos <input type="date">. */
const p = (n: number) => String(n).padStart(2, "0");

export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deslocarDia(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const data = new Date(a, m - 1, d + n);
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

/** Início e fim do dia no fuso do navegador, em ISO (UTC) para a API. */
export function intervaloDoDia(dia: string): { de: string; ate: string } {
  const [a, m, d] = dia.split("-").map(Number);
  return { de: new Date(a, m - 1, d).toISOString(), ate: new Date(a, m - 1, d + 1).toISOString() };
}
