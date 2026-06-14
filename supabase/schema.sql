create extension if not exists vector;

create table if not exists products (
  id text primary key,
  name text,
  category text,
  sub_category text,
  article_type text,
  base_colour text,
  gender text,
  attributes jsonb,
  ai_description text,
  image_path text,
  image_embedding vector(1024),
  text_embedding vector(1024)
);

create table if not exists searches (
  id uuid default gen_random_uuid() primary key,
  query text,
  search_type text,
  filters jsonb,
  num_results int,
  clicked_product_id text,
  created_at timestamptz default now()
);

-- Text search: cosine distance on text_embedding, with optional attribute filters.
-- Attribute filters use substring (ILIKE %v%) matching because the extracted
-- values are free-text (e.g. "pink and red", "cotton blend").
drop function if exists match_products_text(vector(1024), int, text, text);
create or replace function match_products_text(
  query_embedding vector(1024),
  match_count int default 24,
  filter_colour text default null,
  filter_category text default null,
  filter_style text default null,
  filter_material text default null,
  filter_shape text default null
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.text_embedding <=> query_embedding) as score
  from products p
  where (filter_colour is null
         or p.attributes->>'colour' ilike '%' || filter_colour || '%'
         or p.base_colour ilike '%' || filter_colour || '%')
    and (filter_category is null or p.category ilike filter_category)
    and (filter_style is null or p.attributes->>'style' ilike '%' || filter_style || '%')
    and (filter_material is null or p.attributes->>'material' ilike '%' || filter_material || '%')
    and (filter_shape is null or p.attributes->>'shape' ilike '%' || filter_shape || '%')
  order by p.text_embedding <=> query_embedding
  limit match_count;
$$;

-- Image search: cosine distance on image_embedding
create or replace function match_products_image(
  query_embedding vector(1024),
  match_count int default 24
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.image_embedding <=> query_embedding) as score
  from products p
  order by p.image_embedding <=> query_embedding
  limit match_count;
$$;

-- Combined (late fusion): score = alpha * image-similarity + (1-alpha) * text-similarity,
-- each query vector compared to its own catalogue embedding. Lets the image drive visual
-- style while the text drives described attributes (e.g. colour).
drop function if exists match_products_combined(vector(1024), int);
create or replace function match_products_combined(
  image_query vector(1024),
  text_query vector(1024),
  alpha float default 0.5,
  match_count int default 24
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         alpha * (1 - (p.image_embedding <=> image_query))
           + (1 - alpha) * (1 - (p.text_embedding <=> text_query)) as score
  from products p
  order by alpha * (1 - (p.image_embedding <=> image_query))
           + (1 - alpha) * (1 - (p.text_embedding <=> text_query)) desc
  limit match_count;
$$;
