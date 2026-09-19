begin;

-- DOMARO V30.4.1
-- Customer area dropdown catalog. Pricing still comes from shipping_zones:
-- exact area override first, otherwise the governorate default fee.

create table if not exists public.delivery_area_catalog (
  id bigint generated always as identity primary key,
  governorate text not null,
  area text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(governorate) <> ''),
  check (btrim(area) <> '')
);

create unique index if not exists delivery_area_catalog_location_uidx
on public.delivery_area_catalog (
  lower(btrim(governorate)),
  lower(btrim(area))
);

create index if not exists delivery_area_catalog_governorate_idx
on public.delivery_area_catalog (lower(btrim(governorate)))
where active = true;

alter table public.delivery_area_catalog enable row level security;

drop policy if exists "Owner can manage delivery area catalog" on public.delivery_area_catalog;
create policy "Owner can manage delivery area catalog"
on public.delivery_area_catalog
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

revoke all on table public.delivery_area_catalog from anon, authenticated;
grant select, insert, update, delete on table public.delivery_area_catalog to authenticated;

-- Common delivery areas/cities. Missing locations can always use "Other / Not listed"
-- and will automatically fall back to the governorate default rate.
with seed(governorate, area) as (
  values
  ('Cairo','Ain Shams'),('Cairo','Badr City'),('Cairo','Downtown Cairo'),('Cairo','El Marg'),('Cairo','El Shorouk'),('Cairo','Garden City'),('Cairo','Heliopolis'),('Cairo','Helwan'),('Cairo','Maadi'),('Cairo','Madinaty'),('Cairo','Mokattam'),('Cairo','Nasr City'),('Cairo','New Cairo'),('Cairo','Shubra'),('Cairo','Zamalek'),
  ('Giza','6th of October'),('Giza','Agouza'),('Giza','Dokki'),('Giza','Faisal'),('Giza','Giza'),('Giza','Hadayek October'),('Giza','Haram'),('Giza','Imbaba'),('Giza','Mohandessin'),('Giza','Sheikh Zayed'),('Giza','Warraq'),
  ('Alexandria','Agami'),('Alexandria','Bahary'),('Alexandria','Borg El Arab'),('Alexandria','Downtown Alexandria'),('Alexandria','Gleem'),('Alexandria','Kafr Abdo'),('Alexandria','Mandara'),('Alexandria','Miami'),('Alexandria','Montaza'),('Alexandria','Roushdy'),('Alexandria','San Stefano'),('Alexandria','Sidi Gaber'),('Alexandria','Smouha'),('Alexandria','Stanley'),
  ('Qalyubia','Banha'),('Qalyubia','Khanka'),('Qalyubia','Obour City'),('Qalyubia','Qaha'),('Qalyubia','Qalyub'),('Qalyubia','Shebin El Qanater'),('Qalyubia','Shubra El Kheima'),
  ('Sharqia','10th of Ramadan'),('Sharqia','Abu Hammad'),('Sharqia','Abu Kabir'),('Sharqia','Belbeis'),('Sharqia','Faqous'),('Sharqia','Hehia'),('Sharqia','Kafr Saqr'),('Sharqia','Minya El Qamh'),('Sharqia','Zagazig'),
  ('Dakahlia','Aga'),('Dakahlia','Belqas'),('Dakahlia','Dekernes'),('Dakahlia','Gamasa'),('Dakahlia','Mansoura'),('Dakahlia','Manzala'),('Dakahlia','Mit Ghamr'),('Dakahlia','Sherbin'),('Dakahlia','Talkha'),
  ('Gharbia','Basyoun'),('Gharbia','El Mahalla El Kubra'),('Gharbia','Kafr El Zayat'),('Gharbia','Qutour'),('Gharbia','Samanoud'),('Gharbia','Tanta'),('Gharbia','Zefta'),
  ('Monufia','Ashmoun'),('Monufia','Berket El Saba'),('Monufia','Menouf'),('Monufia','Quesna'),('Monufia','Sadat City'),('Monufia','Shebin El Kom'),('Monufia','Tala'),
  ('Beheira','Abu Hummus'),('Beheira','Damanhur'),('Beheira','Edku'),('Beheira','Itay El Baroud'),('Beheira','Kafr El Dawwar'),('Beheira','Kom Hamada'),('Beheira','Nubaria'),('Beheira','Rashid'),('Beheira','Wadi El Natrun'),
  ('Kafr El Sheikh','Baltim'),('Kafr El Sheikh','Biyala'),('Kafr El Sheikh','Burullus'),('Kafr El Sheikh','Desouk'),('Kafr El Sheikh','Fuweh'),('Kafr El Sheikh','Kafr El Sheikh'),('Kafr El Sheikh','Motobas'),('Kafr El Sheikh','Sidi Salem'),
  ('Damietta','Damietta'),('Damietta','Faraskour'),('Damietta','Kafr Saad'),('Damietta','New Damietta'),('Damietta','Ras El Bar'),('Damietta','Zarqa'),
  ('Port Said','Port Fouad'),('Port Said','Port Said'),
  ('Ismailia','Abu Suwir'),('Ismailia','Fayed'),('Ismailia','Ismailia'),('Ismailia','Qantara East'),('Ismailia','Qantara West'),('Ismailia','Tell El Kebir'),
  ('Suez','Ain Sokhna'),('Suez','Arbaeen'),('Suez','Ataka'),('Suez','Faisal'),('Suez','Suez'),
  ('Fayoum','Fayoum'),('Fayoum','Ibshaway'),('Fayoum','Itsa'),('Fayoum','New Fayoum'),('Fayoum','Sinnuris'),('Fayoum','Tamiya'),('Fayoum','Youssef El Seddik'),
  ('Beni Suef','Beni Suef'),('Beni Suef','Biba'),('Beni Suef','El Wasta'),('Beni Suef','Ihnasia'),('Beni Suef','Nasser'),('Beni Suef','New Beni Suef'),('Beni Suef','Samasta'),
  ('Minya','Abu Qurqas'),('Minya','Beni Mazar'),('Minya','Deir Mawas'),('Minya','Maghagha'),('Minya','Mallawi'),('Minya','Matai'),('Minya','Minya'),('Minya','New Minya'),('Minya','Samalut'),
  ('Assiut','Abnoub'),('Assiut','Abu Tig'),('Assiut','Assiut'),('Assiut','Dairut'),('Assiut','El Badari'),('Assiut','El Qusiya'),('Assiut','Manfalut'),('Assiut','New Assiut'),('Assiut','Sahel Selim'),
  ('Sohag','Akhmim'),('Sohag','Dar El Salam'),('Sohag','El Balyana'),('Sohag','El Maragha'),('Sohag','Girga'),('Sohag','New Sohag'),('Sohag','Sohag'),('Sohag','Tahta'),('Sohag','Tima'),
  ('Qena','Abu Tesht'),('Qena','Deshna'),('Qena','Farshout'),('Qena','Nag Hammadi'),('Qena','Naqada'),('Qena','New Qena'),('Qena','Qena'),('Qena','Qus'),
  ('Luxor','Armant'),('Luxor','Esna'),('Luxor','Luxor'),('Luxor','New Tiba'),('Luxor','Qurna'),('Luxor','Tiba'),
  ('Aswan','Abu Simbel'),('Aswan','Aswan'),('Aswan','Daraw'),('Aswan','Edfu'),('Aswan','Kom Ombo'),('Aswan','Nasr El Nuba'),('Aswan','New Aswan'),
  ('Red Sea','El Gouna'),('Red Sea','Hurghada'),('Red Sea','Marsa Alam'),('Red Sea','Quseir'),('Red Sea','Ras Gharib'),('Red Sea','Safaga'),
  ('New Valley','Balat'),('New Valley','Dakhla'),('New Valley','Farafra'),('New Valley','Kharga'),('New Valley','Paris'),
  ('Matrouh','Dabaa'),('Matrouh','El Alamein'),('Matrouh','Marsa Matrouh'),('Matrouh','New Alamein'),('Matrouh','Sallum'),('Matrouh','Sidi Barrani'),('Matrouh','Siwa'),
  ('North Sinai','Arish'),('North Sinai','Bir El Abd'),('North Sinai','Hasana'),('North Sinai','Nakhl'),('North Sinai','Rafah'),('North Sinai','Sheikh Zuweid'),
  ('South Sinai','Abu Rudeis'),('South Sinai','Abu Zenima'),('South Sinai','Dahab'),('South Sinai','Nuweiba'),('South Sinai','Ras Sudr'),('South Sinai','Saint Catherine'),('South Sinai','Sharm El Sheikh'),('South Sinai','Taba'),('South Sinai','Tor Sinai')
)
insert into public.delivery_area_catalog(governorate, area, active)
select s.governorate, s.area, true
from seed s
where not exists (
  select 1
  from public.delivery_area_catalog c
  where lower(btrim(c.governorate)) = lower(btrim(s.governorate))
    and lower(btrim(c.area)) = lower(btrim(s.area))
);

-- Existing custom area overrides are automatically included in the dropdown too.
create or replace function public.get_delivery_areas(p_governorate text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.area order by x.area), '[]'::jsonb)
  from (
    select btrim(c.area) as area
    from public.delivery_area_catalog c
    where c.active = true
      and lower(btrim(c.governorate)) = lower(btrim(p_governorate))
    union
    select btrim(z.area) as area
    from public.shipping_zones z
    where z.active = true
      and lower(btrim(z.governorate)) = lower(btrim(p_governorate))
      and nullif(btrim(coalesce(z.area,'')), '') is not null
  ) x;
$$;

revoke all on function public.get_delivery_areas(text) from public;
grant execute on function public.get_delivery_areas(text) to anon, authenticated;

commit;
