import { createRequire } from "module";
const require = createRequire(import.meta.url);
const jspdfMod = require("jspdf");
// Force default export to work for the ts file
globalThis.jspdf = jspdfMod;
// Patch the module cache so import resolves
process.env.__test = "1";
const { gerarHoraExtraSabadoPDF } = await import("/dev-server/src/lib/hora-extra-sabado-pdf.ts");
import fs from "fs";
const mk = (n, pfx) => Array.from({length:n}, (_,i)=>({nome:`${pfx} FUNC ${String(i+1).padStart(2,"0")} TESTE SILVA`,transporte:i%2===0,alimentacao:i%3===0,presenca:i%4===0?"F":"P"}));
const doc = gerarHoraExtraSabadoPDF({
  data:"24/05/2026",diaSemana:"Sábado",turno:"Diurno",horario:"07:00 às 17:00",
  setor:"Manutenção Industrial",centroCusto:"CC-1234",tipoEfetivo:"DMN",
  observacao:"Equipe convocada para manutenção preventiva.",
  empresasEnvolvidas:["JC GALVÃO","NB CONSTRUÇÃO"],
  paginas:[
    {empresaNome:"JC GALVÃO",funcionarios:mk(31,"JC")},
    {empresaNome:"NB CONSTRUÇÃO",funcionarios:mk(31,"NB")},
  ],
  solicitanteNome:"João da Silva",
});
fs.writeFileSync("/tmp/out.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("ok");
