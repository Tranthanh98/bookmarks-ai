create or replace function insert_bookmark_tags(
  p_bookmark_id uuid,
  p_user_id UUID,
  p_tag_names text[]
)
returns void
language plpgsql
as $$
declare
  tag_name text;
  v_tag_id uuid;
begin
  foreach tag_name in array p_tag_names loop
    -- Insert tag nếu chưa có
    insert into tags (name)
    values (tag_name)
    on conflict (name) do nothing;

    -- Lấy id tag vừa insert hoặc đã có
    select id into v_tag_id from tags where name = tag_name;

    -- Insert vào bookmark_tags
    insert into bookmark_tags (bookmark_id, tag_id, user_id)
    values (p_bookmark_id, v_tag_id, p_user_id)
    on conflict (bookmark_id, tag_id) do nothing;
  end loop;
end;
$$;
