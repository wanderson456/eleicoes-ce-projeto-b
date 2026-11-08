ALTER TABLE votos
ADD COLUMN IF NOT EXISTS tipo_voto VARCHAR(10);

UPDATE votos
SET tipo_voto = CASE
    WHEN sq_candidato = -3 THEN 'LEGENDA'
    WHEN nr_votavel = '95' THEN 'BRANCO'
    WHEN nr_votavel = '96' THEN 'NULO'
    WHEN sq_candidato > 0 THEN 'NOMINAL'
    ELSE NULL
END;

ALTER TABLE votos
ALTER COLUMN tipo_voto SET NOT NULL;

ALTER TABLE votos
ADD CONSTRAINT chk_votos_tipo_voto
CHECK (tipo_voto IN ('NOMINAL', 'LEGENDA', 'BRANCO', 'NULO'));

CREATE INDEX IF NOT EXISTS idx_votos_tipo
ON votos (tipo_voto);
