# 🔧 SQL Migration: Multi-Site + Filtros Temporais (v2)

Execute este SQL no Supabase SQL Editor antes de fazer deploy do código.

---

## 1️⃣ Criar Tabela de Sites

```sql
-- Tabela para armazenar sites/domínios
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índice para buscas rápidas por domínio
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);

-- Habilita RLS (opcional, mas recomendado)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Permite leitura pública (para a API consultar)
CREATE POLICY IF NOT EXISTS "Allow public read sites"
  ON sites FOR SELECT
  USING (true);

-- Permite insert público (para upsert automático)
CREATE POLICY IF NOT EXISTS "Allow public insert sites"
  ON sites FOR INSERT
  WITH CHECK (true);
```

---

## 2️⃣ Adicionar Coluna site_id na Tabela events

```sql
-- Adiciona coluna site_id (referência para tabela sites)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id);

-- Cria índice para performance
CREATE INDEX IF NOT EXISTS idx_events_site_id ON events(site_id);

-- Cria índice composto para queries filtradas por site
CREATE INDEX IF NOT EXISTS idx_events_site_quiz ON events(site_id, quiz_id);
```

---

## 3️⃣ Função Helper: Upsert Site

```sql
-- Função que retorna site_id (cria se não existir)
CREATE OR REPLACE FUNCTION upsert_site(p_domain text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id uuid;
BEGIN
  -- Tenta inserir, se já existir retorna o ID existente
  INSERT INTO sites (domain)
  VALUES (p_domain)
  ON CONFLICT (domain) DO UPDATE SET domain = EXCLUDED.domain
  RETURNING id INTO v_site_id;

  RETURN v_site_id;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION upsert_site(text) TO anon, authenticated;
```

---

## 4️⃣ Função: get_quiz_stats_v2 (com filtros temporais)

```sql
-- Versão 2: Suporta filtros de site, período e agregação temporal
CREATE OR REPLACE FUNCTION get_quiz_stats_v2(
  p_range text DEFAULT 'day',           -- 'hour' | 'day' | 'week'
  p_site_domain text DEFAULT NULL,      -- filtro por domínio (opcional)
  p_days integer DEFAULT 30             -- últimos N dias
)
RETURNS TABLE (
  bucket timestamptz,
  site_domain text,
  quiz_id text,
  views bigint,
  completes bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date_limit timestamptz;
  v_trunc_format text;
BEGIN
  -- Calcula data limite
  v_date_limit := NOW() - (p_days || ' days')::interval;

  -- Define formato de truncamento baseado no range
  v_trunc_format := CASE p_range
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    ELSE 'day'
  END;

  -- Query principal com agregação temporal
  RETURN QUERY
  SELECT
    date_trunc(v_trunc_format, e.created_at) as bucket,
    COALESCE(s.domain, 'unknown') as site_domain,
    e.quiz_id,
    COUNT(*) FILTER (WHERE e.event = 'view') as views,
    COUNT(*) FILTER (WHERE e.event = 'complete') as completes,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.event = 'view') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE e.event = 'complete')::numeric /
           COUNT(*) FILTER (WHERE e.event = 'view')::numeric) * 100,
          1
        )
      ELSE 0
    END as conversion_rate
  FROM events e
  LEFT JOIN sites s ON e.site_id = s.id
  WHERE
    e.created_at >= v_date_limit
    AND (p_site_domain IS NULL OR s.domain = p_site_domain)
  GROUP BY
    date_trunc(v_trunc_format, e.created_at),
    s.domain,
    e.quiz_id
  ORDER BY
    bucket DESC,
    views DESC;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION get_quiz_stats_v2(text, text, integer) TO anon, authenticated;
```

---

## 5️⃣ Função: get_quiz_totals_v2 (totais para ranking)

```sql
-- Versão 2: Retorna totais agregados (sem bucketing temporal)
CREATE OR REPLACE FUNCTION get_quiz_totals_v2(
  p_site_domain text DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  site_domain text,
  quiz_id text,
  views bigint,
  completes bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date_limit timestamptz;
BEGIN
  v_date_limit := NOW() - (p_days || ' days')::interval;

  RETURN QUERY
  SELECT
    COALESCE(s.domain, 'unknown') as site_domain,
    e.quiz_id,
    COUNT(*) FILTER (WHERE e.event = 'view') as views,
    COUNT(*) FILTER (WHERE e.event = 'complete') as completes,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.event = 'view') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE e.event = 'complete')::numeric /
           COUNT(*) FILTER (WHERE e.event = 'view')::numeric) * 100,
          1
        )
      ELSE 0
    END as conversion_rate
  FROM events e
  LEFT JOIN sites s ON e.site_id = s.id
  WHERE
    e.created_at >= v_date_limit
    AND (p_site_domain IS NULL OR s.domain = p_site_domain)
  GROUP BY
    s.domain,
    e.quiz_id
  ORDER BY
    views DESC;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION get_quiz_totals_v2(text, integer) TO anon, authenticated;
```

---

## 6️⃣ Função: get_sites_list (lista de sites disponíveis)

```sql
-- Retorna lista de sites que têm eventos
CREATE OR REPLACE FUNCTION get_sites_list()
RETURNS TABLE (
  domain text,
  total_events bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.domain,
    COUNT(e.id) as total_events,
    MIN(e.created_at) as first_seen,
    MAX(e.created_at) as last_seen
  FROM sites s
  LEFT JOIN events e ON e.site_id = s.id
  GROUP BY s.domain
  HAVING COUNT(e.id) > 0
  ORDER BY total_events DESC;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION get_sites_list() TO anon, authenticated;
```

---

## 🧪 Testes

### Teste 1: Upsert Site
```sql
SELECT upsert_site('seriedrama.com');
SELECT upsert_site('seriedrama.com'); -- Deve retornar mesmo ID
SELECT * FROM sites;
```

### Teste 2: Stats Bucketed (últimas 24h, por hora)
```sql
SELECT * FROM get_quiz_stats_v2('hour', NULL, 1);
```

### Teste 3: Stats Bucketed (últimos 7 dias, por dia, filtrado por site)
```sql
SELECT * FROM get_quiz_stats_v2('day', 'seriedrama.com', 7);
```

### Teste 4: Totais (últimos 30 dias)
```sql
SELECT * FROM get_quiz_totals_v2(NULL, 30);
```

### Teste 5: Lista de Sites
```sql
SELECT * FROM get_sites_list();
```

---

## 📊 Resultado Esperado

### get_quiz_stats_v2:
```
bucket                  | site_domain      | quiz_id | views | completes | conversion_rate
------------------------|------------------|---------|-------|-----------|----------------
2024-10-31 19:00:00+00 | seriedrama.com   | cbcn    | 1523  | 687       | 45.1
2024-10-31 18:00:00+00 | seriedrama.com   | cbcn    | 1456  | 623       | 42.8
...
```

### get_quiz_totals_v2:
```
site_domain      | quiz_id | views | completes | conversion_rate
-----------------|---------|-------|-----------|----------------
seriedrama.com   | cbcn    | 25000 | 11000     | 44.0
seriedrama.com   | wlb     | 3500  | 980       | 28.0
...
```

---

## ⚠️ Notas Importantes

1. **Migração de Dados Existentes:**
   - Se você já tem eventos na tabela `events` sem `site_id`, eles vão aparecer como 'unknown'
   - Para associar eventos antigos a um site, rode:
   ```sql
   -- Exemplo: associar todos os eventos ao site seriedrama.com
   UPDATE events
   SET site_id = (SELECT id FROM sites WHERE domain = 'seriedrama.com')
   WHERE site_id IS NULL;
   ```

2. **Performance:**
   - Os índices criados garantem queries rápidas mesmo com milhões de eventos
   - `get_quiz_stats_v2` com range='hour' pode ser lento se p_days for muito grande (>7)

3. **RLS (Row Level Security):**
   - As políticas permitem acesso público para leitura e insert
   - Se quiser restringir, modifique as políticas

---

**Execute este SQL completo no Supabase antes de fazer deploy do código!**
