-- Friend pet cards include the closet pieces that player owns.
-- Apply on the hosted project. Does not delete auth.users.

create or replace function public.friend_pet_card(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pet public.pets%rowtype;
  owned jsonb;
begin
  select * into pet from public.pets
    where owner_user_id = p_user_id and status = 'active'
    limit 1;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('slot', slot, 'id', wear)), '[]'::jsonb)
    into owned
  from (
    select distinct slot, wear
    from (
      select split_part(asset, ':', 1) as slot, split_part(asset, ':', 2) as wear
      from (
        select line->>'asset' as asset, sum((line->>'delta')::numeric) as qty
        from public.ledger_entries e
        cross join lateral jsonb_array_elements(coalesce(e.lines, '[]'::jsonb)) line
        where e.user_id = p_user_id
          and line->>'asset' ~ '^(hat|glasses|neckwear|jacket|boots):[^:]+$'
        group by line->>'asset'
      ) totals
      where qty > 0
      union
      select key as slot, value as wear
      from jsonb_each_text(coalesce(pet.doc->'equipped', '{}'::jsonb))
      where key in ('hat', 'glasses', 'neckwear', 'jacket', 'boots')
        and value is not null
        and value <> ''
        and value <> 'none'
    ) pieces
  ) distinct_pieces;

  return jsonb_build_object(
    'petId', pet.id,
    'name', pet.doc->>'name',
    'breedId', pet.doc->>'breedId',
    'look', coalesce(pet.doc->'look', '{}'::jsonb),
    'equipped', coalesce(pet.doc->'equipped', '{}'::jsonb),
    'owned', owned,
    'ageDays', coalesce((pet.doc->>'ageDays')::numeric, 0),
    'weight', coalesce((pet.doc->>'weight')::numeric, 0),
    'vitality', coalesce((pet.doc->>'vitality')::numeric, 0),
    'seed', coalesce((pet.doc#>>'{attributes,seed}')::numeric, 1),
    'originArchetype', coalesce(pet.doc#>>'{attributes,archetype}', 'charmer'),
    'attributes', coalesce(pet.doc#>'{attributes,current}', '{}'::jsonb),
    'potential', coalesce(pet.doc#>'{attributes,potential}', '{}'::jsonb)
  );
end;
$$;
