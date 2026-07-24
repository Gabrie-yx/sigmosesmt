// stub dmnLogo import
import { readFileSync, writeFileSync } from "fs";
globalThis.__stub = true;
const mod = await import("./src/lib/cipa-calendario-pdf.ts");
const doc = mod.buildCipaCalendarioPdf({
  razaoSocial: "DMN Estaleiro da Amazônida LTDA",
  gestao: "2024/2025",
  linhas: Array.from({length:12},(_,i)=>({numero:i+1,mes:i<3?["Janeiro","Fevereiro","Março"][i]:"",horario:i<3?"14:00":"",status:i===0?"R":i===1?"NC":i===2?"RP":"P",reprogramado:i===2?"15/04/2025":"",statusReprog:i===2?"P":""})),
  dataEmissao:"2025-08-30",
  dataRevisao:"2025-08-30",
  elaboradoPor:"SESMT",
  aprovadoPor:"Presidente CIPA",
});
writeFileSync("/tmp/qa-cipa.pdf", Buffer.from(doc.output("arraybuffer")));
