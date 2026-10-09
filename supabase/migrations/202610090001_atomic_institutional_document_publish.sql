create or replace function public.publish_institutional_document(
  p_document_id uuid,
  p_title text,
  p_description text,
  p_category public.document_category,
  p_tracks_completion boolean,
  p_target_departments text[],
  p_target_semesters smallint[],
  p_target_sections text[],
  p_expires_at timestamptz,
  p_candidate_events jsonb,
  p_candidate_timetable jsonb,
  p_is_draft boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_timetable_id uuid;
  v_now timestamptz := now();
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'An administrator session is required';
  end if;

  if p_document_id is null then raise exception 'A document ID is required'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 200 then
    raise exception 'Document title must contain 1 to 200 characters';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 5000 then
    raise exception 'Document description must be 5000 characters or fewer';
  end if;
  if p_category is null then raise exception 'A document category is required'; end if;
  if p_tracks_completion is null or p_is_draft is null then
    raise exception 'Document publishing flags are required';
  end if;
  if p_target_departments is not null and (
    cardinality(p_target_departments) < 1 or cardinality(p_target_departments) > 5
    or exists (
      select 1
      from unnest(p_target_departments) as target(department)
      where target.department is null
        or target.department not in ('CSE', 'ECE', 'ME', 'CE', 'IT')
    )
    or (select count(distinct target.department)
      from unnest(p_target_departments) as target(department))
    <> cardinality(p_target_departments)
  ) then
    raise exception 'Target departments must contain 1 to 5 valid department codes';
  end if;
  if p_target_semesters is not null and (
    cardinality(p_target_semesters) < 1 or cardinality(p_target_semesters) > 8
    or exists (
      select 1 from unnest(p_target_semesters) as target(semester)
      where target.semester is null or target.semester < 1 or target.semester > 8
    )
    or (select count(distinct target.semester)
        from unnest(p_target_semesters) as target(semester))
      <> cardinality(p_target_semesters)
  ) then
    raise exception 'Target semesters must contain 1 to 8 values between 1 and 8';
  end if;
  if p_target_sections is not null and (
    cardinality(p_target_sections) < 1 or cardinality(p_target_sections) > 30
    or exists (
      select 1
      from unnest(p_target_sections) as target(section)
      where nullif(btrim(target.section), '') is null
        or char_length(btrim(target.section)) > 10
        or target.section <> upper(btrim(target.section))
    )
    or (select count(distinct target.section)
        from unnest(p_target_sections) as target(section))
      <> cardinality(p_target_sections)
  ) then
    raise exception 'Target sections must contain 1 to 30 unique, uppercase, trimmed values of at most 10 characters';
  end if;
  if p_candidate_events is null or jsonb_typeof(p_candidate_events) <> 'array' then
    raise exception 'Candidate events must be a JSON array';
  end if;
  if jsonb_array_length(p_candidate_events) > 200 then
    raise exception 'At most 200 candidate events are allowed';
  end if;
  for v_item in select value from jsonb_array_elements(p_candidate_events) as items(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item -> 'title') is distinct from 'string'
      or nullif(btrim(v_item ->> 'title'), '') is null
      or char_length(btrim(v_item ->> 'title')) > 200
      or jsonb_typeof(v_item -> 'event_type') is distinct from 'string'
      or coalesce(v_item ->> 'event_type', '') not in (
        'exam', 'assignment_deadline', 'registration_deadline',
        'admission_deadline', 'scholarship_deadline', 'semester_start',
        'semester_end', 'holiday', 'class_event', 'other'
      )
      or jsonb_typeof(v_item -> 'starts_at') is distinct from 'string'
      or coalesce(v_item ->> 'starts_at', '') !~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      or (v_item ? 'description' and v_item -> 'description' <> 'null'::jsonb
        and (jsonb_typeof(v_item -> 'description') is distinct from 'string'
          or char_length(btrim(v_item ->> 'description')) > 2000))
      or (v_item ? 'ends_at' and v_item -> 'ends_at' <> 'null'::jsonb
        and (jsonb_typeof(v_item -> 'ends_at') is distinct from 'string'
          or coalesce(v_item ->> 'ends_at', '') !~
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$'))
      or (v_item ? 'all_day' and jsonb_typeof(v_item -> 'all_day') is distinct from 'boolean')
    then
      raise exception 'Candidate events contain an invalid or out-of-range value';
    end if;
  end loop;
  if p_candidate_timetable is not null
    and jsonb_typeof(p_candidate_timetable) <> 'object'
  then
    raise exception 'Candidate timetable must be an object or null';
  end if;
  if p_candidate_timetable is not null
    and coalesce(jsonb_typeof(p_candidate_timetable -> 'entries'), '') <> 'array'
  then
    raise exception 'Candidate timetable entries must be a JSON array';
  end if;
  if p_candidate_timetable is not null then
    if jsonb_typeof(p_candidate_timetable -> 'name') is distinct from 'string'
      or nullif(btrim(p_candidate_timetable ->> 'name'), '') is null
      or char_length(btrim(p_candidate_timetable ->> 'name')) > 200
      or jsonb_typeof(p_candidate_timetable -> 'valid_from') is distinct from 'string'
      or coalesce(p_candidate_timetable ->> 'valid_from', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or (p_candidate_timetable ? 'valid_until'
        and p_candidate_timetable -> 'valid_until' <> 'null'::jsonb
        and (jsonb_typeof(p_candidate_timetable -> 'valid_until') is distinct from 'string'
          or coalesce(p_candidate_timetable ->> 'valid_until', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
      or jsonb_array_length(p_candidate_timetable -> 'entries') < 1
      or jsonb_array_length(p_candidate_timetable -> 'entries') > 500
    then
      raise exception 'Candidate timetable must have a valid name, start date, and 1 to 500 entries';
    end if;

    for v_item in
      select value
      from jsonb_array_elements(p_candidate_timetable -> 'entries') as items(value)
    loop
      if jsonb_typeof(v_item) <> 'object'
        or jsonb_typeof(v_item -> 'day_of_week') <> 'number'
        or coalesce(v_item ->> 'day_of_week', '') !~ '^[1-7]$'
          or jsonb_typeof(v_item -> 'start_time') is distinct from 'string'
          or coalesce(v_item ->> 'start_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          or jsonb_typeof(v_item -> 'end_time') is distinct from 'string'
          or coalesce(v_item ->> 'end_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          or jsonb_typeof(v_item -> 'subject') is distinct from 'string'
          or nullif(btrim(v_item ->> 'subject'), '') is null
          or char_length(btrim(v_item ->> 'subject')) > 200
        or (v_item ? 'room' and v_item -> 'room' <> 'null'::jsonb
            and (jsonb_typeof(v_item -> 'room') is distinct from 'string'
              or char_length(btrim(v_item ->> 'room')) > 100))
          or (v_item ? 'instructor' and v_item -> 'instructor' <> 'null'::jsonb
            and (jsonb_typeof(v_item -> 'instructor') is distinct from 'string'
              or char_length(btrim(v_item ->> 'instructor')) > 200))
      then
        raise exception 'Candidate timetable contains an invalid or out-of-range entry';
      end if;
    end loop;
  end if;

  perform 1
  from public.documents as d
  where d.id = p_document_id
    and d.uploaded_by = (select auth.uid())
    and d.status in ('processing'::public.document_status, 'draft'::public.document_status)
  for update;

  if not found then
    raise exception 'Processing document not found or no longer editable';
  end if;

  update public.documents
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      category = p_category,
      status = 'draft'::public.document_status,
      tracks_completion = p_tracks_completion,
      target_departments = p_target_departments,
      target_semesters = p_target_semesters,
      target_sections = p_target_sections,
      expires_at = p_expires_at,
      published_at = null,
      updated_at = v_now
  where id = p_document_id
    and uploaded_by = (select auth.uid());

  delete from public.academic_events
  where source_document_id = p_document_id;

  insert into public.academic_events (
    source_document_id,
    title,
    description,
    event_type,
    starts_at,
    ends_at,
    all_day,
    target_departments,
    target_semesters,
    target_sections
  )
  select
    p_document_id,
    event_row.title,
    nullif(btrim(event_row.description), ''),
    event_row.event_type,
    event_row.starts_at,
    event_row.ends_at,
    coalesce(event_row.all_day, false),
    p_target_departments,
    p_target_semesters,
    p_target_sections
  from jsonb_to_recordset(p_candidate_events) as event_row(
    title text,
    description text,
    event_type public.academic_event_type,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean
  );

  delete from public.timetables
  where source_document_id = p_document_id;

  if p_candidate_timetable is not null then
    insert into public.timetables (
      source_document_id,
      name,
      target_departments,
      target_semesters,
      target_sections,
      valid_from,
      valid_until,
      updated_at
    )
    values (
      p_document_id,
      btrim(p_candidate_timetable ->> 'name'),
      p_target_departments,
      p_target_semesters,
      p_target_sections,
      (p_candidate_timetable ->> 'valid_from')::date,
      nullif(p_candidate_timetable ->> 'valid_until', '')::date,
      v_now
    )
    returning id into v_timetable_id;

    insert into public.timetable_entries (
      timetable_id,
      day_of_week,
      start_time,
      end_time,
      subject,
      room,
      instructor
    )
    select
      v_timetable_id,
      entry.day_of_week,
      entry.start_time,
      entry.end_time,
      entry.subject,
      nullif(btrim(entry.room), ''),
      nullif(btrim(entry.instructor), '')
    from jsonb_to_recordset(p_candidate_timetable -> 'entries') as entry(
      day_of_week smallint,
      start_time time,
      end_time time,
      subject text,
      room text,
      instructor text
    );
  end if;

  if not p_is_draft then
    update public.documents
    set status = 'published'::public.document_status,
        published_at = v_now,
        updated_at = v_now
    where id = p_document_id
      and uploaded_by = (select auth.uid());
  end if;

  return p_document_id;
end;
$$;

revoke all on function public.publish_institutional_document(
  uuid, text, text, public.document_category, boolean, text[], smallint[],
  text[], timestamptz, jsonb, jsonb, boolean
) from public, anon;
grant execute on function public.publish_institutional_document(
  uuid, text, text, public.document_category, boolean, text[], smallint[],
  text[], timestamptz, jsonb, jsonb, boolean
) to authenticated;

create or replace function public.update_draft_institutional_document_metadata(
  p_document_id uuid,
  p_title text,
  p_description text,
  p_category public.document_category,
  p_tracks_completion boolean,
  p_target_departments text[],
  p_target_semesters smallint[],
  p_target_sections text[],
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'An administrator session is required';
  end if;

  if p_document_id is null then raise exception 'A document ID is required'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 200 then
    raise exception 'Document title must contain 1 to 200 characters';
  end if;
  if p_description is not null and char_length(btrim(p_description)) > 5000 then
    raise exception 'Document description must be 5000 characters or fewer';
  end if;
  if p_category is null then raise exception 'A document category is required'; end if;
  if p_tracks_completion is null then raise exception 'Completion tracking value is required'; end if;

  if p_target_departments is not null and (
    cardinality(p_target_departments) < 1 or cardinality(p_target_departments) > 5
    or exists (
      select 1 from unnest(p_target_departments) as target(department)
      where target.department is null
        or target.department not in ('CSE', 'ECE', 'ME', 'CE', 'IT')
    )
    or (select count(distinct target.department)
        from unnest(p_target_departments) as target(department))
      <> cardinality(p_target_departments)
  ) then
    raise exception 'Target departments must contain 1 to 5 unique valid department codes';
  end if;
  if p_target_semesters is not null and (
    cardinality(p_target_semesters) < 1 or cardinality(p_target_semesters) > 8
    or exists (
      select 1 from unnest(p_target_semesters) as target(semester)
      where target.semester is null or target.semester < 1 or target.semester > 8
    )
    or (select count(distinct target.semester)
        from unnest(p_target_semesters) as target(semester))
      <> cardinality(p_target_semesters)
  ) then
    raise exception 'Target semesters must contain 1 to 8 unique values between 1 and 8';
  end if;
  if p_target_sections is not null and (
    cardinality(p_target_sections) < 1 or cardinality(p_target_sections) > 30
    or exists (
      select 1 from unnest(p_target_sections) as target(section)
      where nullif(btrim(target.section), '') is null
        or char_length(btrim(target.section)) > 10
        or target.section <> upper(btrim(target.section))
    )
    or (select count(distinct target.section)
        from unnest(p_target_sections) as target(section))
      <> cardinality(p_target_sections)
  ) then
    raise exception 'Target sections must contain 1 to 30 unique, uppercase, trimmed values of at most 10 characters';
  end if;

  perform 1
  from public.documents as d
  where d.id = p_document_id
    and d.uploaded_by = (select auth.uid())
    and d.status = 'draft'::public.document_status
  for update;

  if not found then
    raise exception 'Draft document not found or not editable';
  end if;

  update public.documents
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      category = p_category,
      tracks_completion = p_tracks_completion,
      target_departments = p_target_departments,
      target_semesters = p_target_semesters,
      target_sections = p_target_sections,
      expires_at = p_expires_at,
      updated_at = now()
  where id = p_document_id
    and uploaded_by = (select auth.uid());

  update public.academic_events
  set target_departments = p_target_departments,
      target_semesters = p_target_semesters,
      target_sections = p_target_sections
  where source_document_id = p_document_id;

  update public.timetables
  set target_departments = p_target_departments,
      target_semesters = p_target_semesters,
      target_sections = p_target_sections,
      updated_at = now()
  where source_document_id = p_document_id;

  return p_document_id;
end;
$$;

revoke all on function public.update_draft_institutional_document_metadata(
  uuid, text, text, public.document_category, boolean, text[], smallint[],
  text[], timestamptz
) from public, anon;
grant execute on function public.update_draft_institutional_document_metadata(
  uuid, text, text, public.document_category, boolean, text[], smallint[],
  text[], timestamptz
) to authenticated;
