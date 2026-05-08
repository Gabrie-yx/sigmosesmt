import { supabase } from "@/integrations/supabase/client";

export async function exportBackup() {
  const [companies, roles, employees, exams, docs, epis, ptes] = await Promise.all([
    supabase.from("companies").select("*"),
    supabase.from("roles").select("*"),
    supabase.from("employees").select("*"),
    supabase.from("employee_exams").select("*"),
    supabase.from("employee_docs").select("*"),
    supabase.from("epi_deliveries").select("*"),
    supabase.from("ptes").select("*"),
  ]);
  const payload = {
    version: "envicorp-v1",
    exportedAt: new Date().toISOString(),
    companies: companies.data ?? [],
    roles: roles.data ?? [],
    employees: employees.data ?? [],
    exams: exams.data ?? [],
    docs: docs.data ?? [],
    epis: epis.data ?? [],
    ptes: ptes.data ?? [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `envicorp-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importBackup(json: any) {
  if (json.version === "envicorp-v1") return importV1(json);
  if (json.companies && json.employees) return importLegacy(json);
  throw new Error("Formato de backup não reconhecido");
}

async function importV1(p: any) {
  if (p.companies?.length) {
    const { error } = await supabase.from("companies").upsert(p.companies);
    if (error) throw error;
  }
  if (p.roles?.length) {
    const { error } = await supabase.from("roles").upsert(p.roles);
    if (error) throw error;
  }
  if (p.employees?.length) {
    const { error } = await supabase.from("employees").upsert(p.employees);
    if (error) throw error;
  }
  if (p.exams?.length) await supabase.from("employee_exams").upsert(p.exams);
  if (p.docs?.length) await supabase.from("employee_docs").upsert(p.docs);
  if (p.epis?.length) await supabase.from("epi_deliveries").upsert(p.epis);
  if (p.ptes?.length) await supabase.from("ptes").upsert(p.ptes);
}

async function importLegacy(d: any) {
  const companyMap = new Map<string, string>();
  const roleMap = new Map<string, string>();

  for (const c of d.companies ?? []) {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: c.name,
        type: c.type ?? "CLT",
        cnpj: c.cnpj ?? null,
        encarregado1: c.encarregado1 ?? null,
        encarregado2: c.encarregado2 ?? null,
        email: c.email ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    companyMap.set(c.id, data.id);
  }

  for (const r of d.roles ?? []) {
    const { data, error } = await supabase
      .from("roles")
      .insert({
        name: r.name,
        req_aso: r.reqAso ?? true,
        req_integra: r.reqIntegra ?? true,
        req_nrs: r.reqNRs ?? [],
      })
      .select("id")
      .single();
    if (error) throw error;
    roleMap.set(r.id, data.id);
  }

  for (const e of d.employees ?? []) {
    const { data, error } = await supabase
      .from("employees")
      .insert({
        company_id: companyMap.get(e.companyId) ?? null,
        role_id: roleMap.get(e.roleId) ?? null,
        nome: e.nome,
        cpf: e.cpf ?? null,
        rg: e.rg ?? null,
        rg_orgao: e.rgOrgao ?? null,
        cnpj: e.cnpj ?? null,
        endereco: e.endereco ?? null,
        bairro: e.bairro ?? null,
        cidade: e.cidade ?? null,
        uf: e.uf ?? null,
        cep: e.cep ?? null,
        whatsapp: e.whatsapp ?? null,
        whatsapp_emergencia: e.whatsappEmergencia ?? null,
        nome_contato: e.nomeContato ?? null,
        email: e.email ?? null,
        tipo_cadastro: e.tipoCadastro ?? "NAO_MEI",
        matricula: e.matricula ?? null,
        admissao: e.dataAdmissao || e.admissao || null,
        status: e.status ?? "ATIVO",
        data_aso: e.dataAso || null,
        data_integracao: e.dataIntegracao || null,
        nrs: e.nrs ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;

    for (const ex of e.exames ?? []) {
      await supabase.from("employee_exams").insert({
        employee_id: data.id,
        tipo_exame: ex.tipo_exame,
        natureza: ex.natureza ?? "Periódico",
        data_realizacao: ex.data_realizacao,
        data_vencimento: ex.data_vencimento,
        periodicidade_meses: Number(ex.periodicidade) || 12,
        aptidao: ex.aptidao ?? "SIM",
      });
    }

    for (const epi of e.epis ?? []) {
      await supabase.from("epi_deliveries").insert({
        employee_id: data.id,
        item: epi.nome ?? epi.item ?? "EPI",
        ca: epi.ca ?? null,
        qtd: Number(epi.qtd) || 1,
        data_entrega: epi.data_entrega || epi.data || new Date().toISOString().slice(0, 10),
      });
    }
  }

  for (const p of d.ptes ?? []) {
    await supabase.from("ptes").insert({
      numero: p.id ?? null,
      local: p.local ?? null,
      risco: p.risco ?? null,
      status: p.status ?? "ATIVA",
      employee_name: p.empName ?? null,
      data_emissao: p.dataEmissao ? new Date(p.dataEmissao).toISOString() : new Date().toISOString(),
      dados: p,
    });
  }
}