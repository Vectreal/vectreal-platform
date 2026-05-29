-- Storage bucket for scene assets (replaces Google Cloud Storage).
-- All server-side operations use the service role key and bypass RLS.
-- RLS policies below cover potential future client-side downloads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  104857600, -- 100 MiB
  null       -- accept any MIME type
)
on conflict (id) do nothing;

-- Enable RLS on the objects table (enabled by default in Supabase Storage).
alter table storage.objects enable row level security;

-- Org members may read files that belong to their organisation's scenes.
-- Path format: scenes/{sceneId}/assets/{assetId}/{fileName}
create policy "org members can read their scene assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and exists (
      select 1
      from scenes s
      join projects p on p.id = s.project_id
      join organization_memberships om
        on om.organization_id = p.organization_id
      where
        s.id = (string_to_array(name, '/'))[2]::uuid
        and om.user_id = auth.uid()
    )
  );

-- Org owners and admins may insert new files.
create policy "org admins can upload scene assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and exists (
      select 1
      from scenes s
      join projects p on p.id = s.project_id
      join organization_memberships om
        on om.organization_id = p.organization_id
      where
        s.id = (string_to_array(name, '/'))[2]::uuid
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Org owners and admins may delete files.
create policy "org admins can delete scene assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and exists (
      select 1
      from scenes s
      join projects p on p.id = s.project_id
      join organization_memberships om
        on om.organization_id = p.organization_id
      where
        s.id = (string_to_array(name, '/'))[2]::uuid
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );
