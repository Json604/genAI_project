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

-- Text search: cosine distance on text_embedding, with optional filters
create or replace function match_products_text(
  query_embedding vector(1024),
  match_count int default 24,
  filter_colour text default null,
  filter_category text default null
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.text_embedding <=> query_embedding) as score
  from products p
  where (filter_colour is null or p.attributes->>'colour' ilike filter_colour)
    and (filter_category is null or p.category ilike filter_category)
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

-- Combined: caller passes a pre-blended query vector; match against image_embedding
create or replace function match_products_combined(
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
