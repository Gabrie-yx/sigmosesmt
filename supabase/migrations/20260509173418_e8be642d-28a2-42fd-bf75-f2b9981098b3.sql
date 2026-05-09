UPDATE companies SET type = 'TERCEIRIZADO' WHERE name IN ('JC GALVÃO','DMN');
UPDATE companies SET type = 'CLT' WHERE name = 'NB CONSTRUÇÃO';
UPDATE companies SET type = 'CLT' WHERE name ILIKE '%DMN%' AND name ILIKE '%estaleiro%';