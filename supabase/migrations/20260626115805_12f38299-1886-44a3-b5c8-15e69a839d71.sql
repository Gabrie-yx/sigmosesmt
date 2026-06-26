UPDATE public.producao_base_materia_prima
SET tipo = CASE
  WHEN descricao ~* '(\mgas\M|\moxig|\macetilen|\margon|\mco2\M|\mnitrog|\mmistura\M|\mcilindro\M)' THEN 'GÁS'
  WHEN descricao ~* '(\msolda\M|\meletrod|\marame.*(weld|tubular|mig|solda)|\mdenver\M|\mfluxo.*sold|\mvareta\M|\mtig\M|\mmig\M|\mweld\M|\m7018\M|\m6013\M|\me71t\M|\mer-?70\M)' THEN 'SOLDA'
  WHEN descricao ~* '(\mtinta\M|\mprimer\M|\mesmalte\M|\mepox|\mthinner\M|\mdiluen|\msolvent|\mverniz\M|\mfundo\M|\minterlac\M|\minterprime\M|\mintergard\M|\minterseal\M|\minternational\M.*\m(redutor|gta[0-9]*)\M|\mredutor\M.*\m(gta[0-9]*|international)\M)' THEN 'TINTA'
  WHEN descricao ~* '(\mferro\M|\mchapa\M|\mcantone|\mperfil\M|\mbarra\M|\mvergalh|\mtubo\M|\mtarugo\M|\mtrefilad|\maco\M|\maço\M|\ma36\M|\mastm\M|\mlaminad|\mredondo\M|\mquadrado\M|\msextavad|\mparafuso\M|\mporca\M|\marruela\M|\mflange\M|\mcotovelo\M|\mreducao\M|\mredução\M|\mvalvula\M|\mválvula\M|\mniple\M|\mluva\M|\mbocal\M|\mterminal\M|\mgalvaniz|\mgonzo\M|\mestrutura\M)' THEN 'FERRO'
  ELSE tipo
END,
updated_at = now()
WHERE tipo = 'OUTROS'
  AND descricao IS NOT NULL
  AND descricao ~* '(\mgas\M|\moxig|\macetilen|\margon|\mco2\M|\mnitrog|\mmistura\M|\mcilindro\M|\msolda\M|\meletrod|\marame.*(weld|tubular|mig|solda)|\mdenver\M|\mfluxo.*sold|\mvareta\M|\mtig\M|\mmig\M|\mweld\M|\m7018\M|\m6013\M|\me71t\M|\mer-?70\M|\mtinta\M|\mprimer\M|\mesmalte\M|\mepox|\mthinner\M|\mdiluen|\msolvent|\mverniz\M|\mfundo\M|\minterlac\M|\minterprime\M|\mintergard\M|\minterseal\M|\minternational\M.*\m(redutor|gta[0-9]*)\M|\mredutor\M.*\m(gta[0-9]*|international)\M|\mferro\M|\mchapa\M|\mcantone|\mperfil\M|\mbarra\M|\mvergalh|\mtubo\M|\mtarugo\M|\mtrefilad|\maco\M|\maço\M|\ma36\M|\mastm\M|\mlaminad|\mredondo\M|\mquadrado\M|\msextavad|\mparafuso\M|\mporca\M|\marruela\M|\mflange\M|\mcotovelo\M|\mreducao\M|\mredução\M|\mvalvula\M|\mválvula\M|\mniple\M|\mluva\M|\mbocal\M|\mterminal\M|\mgalvaniz|\mgonzo\M|\mestrutura\M)';