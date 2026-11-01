-- Race snapshots now include hydration so a replay can apply the top-speed penalty.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.stadium_modifier_snapshot(p_doc jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'energy', coalesce((p_doc->'needs'->>'energy')::numeric, 0),
    'mood', coalesce((p_doc->'needs'->>'happiness')::numeric, 0),
    'hydration', coalesce((p_doc->>'hydration')::numeric, 85),
    'stamina', coalesce((p_doc->'attributes'->'current'->>'stamina')::numeric, 0),
    'agility', coalesce((p_doc->'attributes'->'current'->>'agility')::numeric, 0),
    'intelligence', coalesce((p_doc->'attributes'->'current'->>'intelligence')::numeric, 0)
  );
$$;

comment on function public.stadium_modifier_snapshot(jsonb) is
  'Snapshot keys: needs.energy, needs.happiness, hydration, attributes.current.stamina, attributes.current.agility, attributes.current.intelligence.';
